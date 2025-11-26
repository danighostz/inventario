// script.js - Sistema de Inventario con Autenticación - CORREGIDO

document.addEventListener('DOMContentLoaded', function() {
    // Verificar en qué página estamos
    if (document.getElementById('loginForm')) {
        initializeAuthPage();
    } else {
        initializeDashboard();
    }
});

// ===== SISTEMA DE AUTENTICACIÓN =====
function initializeAuthPage() {
    // Configurar tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const authForms = document.querySelectorAll('.auth-form');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            // Actualizar tabs activos
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Mostrar formulario correspondiente
            authForms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${tab}Form`) {
                    form.classList.add('active');
                }
            });
        });
    });

    // Toggle visibilidad de contraseña
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
            }
        });
    });

    // Manejar login
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        loginUser(email, password);
    });

    // Manejar registro
    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        
        if (password !== confirmPassword) {
            showAuthMessage('Las contraseñas no coinciden', 'error');
            return;
        }
        
        registerUser(name, email, password);
    });
}

async function loginUser(email, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            showAuthMessage('¡Bienvenido! Redirigiendo...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } else {
            showAuthMessage(data.error || 'Error en el login', 'error');
        }
    } catch (error) {
        showAuthMessage('Error de conexión', 'error');
    }
}

async function registerUser(name, email, password) {
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showAuthMessage('¡Cuenta creada! Redirigiendo...', 'success');
            setTimeout(() => {
                // Cambiar a pestaña de login
                document.querySelector('[data-tab="login"]').click();
                document.getElementById('loginEmail').value = email;
            }, 1500);
        } else {
            showAuthMessage(data.error || 'Error en el registro', 'error');
        }
    } catch (error) {
        showAuthMessage('Error de conexión', 'error');
    }
}

function showAuthMessage(message, type) {
    const messageEl = document.getElementById('authMessage');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

// ===== DASHBOARD PRINCIPAL =====
function initializeDashboard() {
    // Verificar autenticación
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');
    
    if (!user || !token) {
        window.location.href = 'login.html';
        return;
    }

    // Mostrar información del usuario
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userInitial').textContent = user.name.charAt(0).toUpperCase();

    // Configurar navegación
    setupNavigation();

    // Cargar datos iniciales
    loadDashboardData();
    loadInventory();

    // Configurar formulario de producto
    document.getElementById('productForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addProduct();
    });

    // Configurar búsqueda CON DEBOUNCE
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filterInventory(this.value);
        }, 300);
    });

    // Configurar logout
    document.getElementById('btnLogout').addEventListener('click', function() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });
}

function setupNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    const sections = document.querySelectorAll('.dashboard-section');

    navTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            
            // Actualizar tabs activos
            navTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Mostrar sección correspondiente
            sections.forEach(section => {
                section.style.display = 'none';
                if (section.id === `${target}Section`) {
                    section.style.display = 'block';
                }
            });

            // Si vamos a inventario, recargar datos
            if (target === 'inventory') {
                loadInventory();
            }
        });
    });
}

async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard/stats', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            updateDashboardStats(stats);
        }
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

function updateDashboardStats(stats) {
    document.getElementById('totalProducts').textContent = stats.totalProducts || 0;
    document.getElementById('lowStock').textContent = stats.lowStock || 0;
    document.getElementById('totalValue').textContent = `$${(stats.totalValue || 0).toFixed(2)}`;
    document.getElementById('outOfStock').textContent = stats.outOfStock || 0;
}

// ===== GESTIÓN DE INVENTARIO =====
async function loadInventory() {
    try {
        console.log('🔄 Cargando inventario...');
        const response = await fetch('/api/products', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const products = await response.json();
            console.log('✅ Productos cargados:', products);
            displayInventory(products);
        } else {
            console.error('❌ Error en la respuesta:', response.status);
        }
    } catch (error) {
        console.error('❌ Error cargando inventario:', error);
        showNotification('Error al cargar el inventario', 'error');
    }
}

function displayInventory(products) {
    const tableContainer = document.getElementById('inventoryTable');
    
    if (products.length === 0) {
        tableContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No hay productos en el inventario</h3>
                <p>Agrega tu primer producto para comenzar</p>
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Stock</th>
                    <th>Valor Total</th>
                    <th>Proveedor</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    products.forEach(product => {
        const stockStatus = getStockStatus(product.cantidad);
        const totalValue = (product.precio * product.cantidad).toFixed(2);
        
        tableHTML += `
            <tr class="product-row" 
                data-name="${product.nombre.toLowerCase()}"
                data-category="${product.categoria.toLowerCase()}"
                data-supplier="${(product.proveedor || '').toLowerCase()}"
                data-description="${(product.descripcion || '').toLowerCase()}">
                <td>
                    <strong class="product-name">${product.nombre}</strong>
                    ${product.descripcion ? `<br><small class="product-description">${product.descripcion}</small>` : ''}
                </td>
                <td><span class="badge category-badge">${product.categoria}</span></td>
                <td>$${parseFloat(product.precio).toFixed(2)}</td>
                <td>
                    <span class="badge ${stockStatus.class}">
                        ${product.cantidad} ${stockStatus.text}
                    </span>
                </td>
                <td>$${totalValue}</td>
                <td class="supplier-info">${product.proveedor || 'N/A'}</td>
                <td class="actions">
                    <button class="action-btn view" onclick="viewProduct(${product.id})" title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit" onclick="editProduct(${product.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteProduct(${product.id})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    tableContainer.innerHTML = tableHTML;
    console.log('✅ Tabla de inventario actualizada');
}

function getStockStatus(quantity) {
    if (quantity === 0) return { class: 'danger', text: 'Agotado' };
    if (quantity <= 5) return { class: 'warning', text: 'Bajo' };
    return { class: 'success', text: 'Disponible' };
}

// FUNCIÓN DE BÚSQUEDA CORREGIDA
function filterInventory(searchTerm) {
    const searchValue = searchTerm.toLowerCase().trim();
    const rows = document.querySelectorAll('#inventoryTable .product-row');
    
    console.log(`🔍 Buscando: "${searchValue}" en ${rows.length} productos`);
    
    if (searchValue === '') {
        // Mostrar todos si no hay búsqueda
        rows.forEach(row => {
            row.style.display = '';
        });
        console.log('✅ Mostrando todos los productos');
        return;
    }
    
    let foundCount = 0;
    
    rows.forEach(row => {
        const productName = row.getAttribute('data-name');
        const category = row.getAttribute('data-category');
        const supplier = row.getAttribute('data-supplier');
        const description = row.getAttribute('data-description');
        
        // Buscar en todos los campos
        const match = productName.includes(searchValue) ||
                     category.includes(searchValue) ||
                     supplier.includes(searchValue) ||
                     description.includes(searchValue);
        
        if (match) {
            row.style.display = '';
            foundCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    console.log(`✅ Encontrados ${foundCount} productos`);
    
    // Mostrar mensaje si no se encontraron resultados
    const tableBody = document.querySelector('#inventoryTable tbody');
    if (tableBody) {
        const existingMessage = tableBody.querySelector('.no-results-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        if (foundCount === 0 && searchValue !== '') {
            const noResultsRow = document.createElement('tr');
            noResultsRow.className = 'no-results-message';
            noResultsRow.innerHTML = `
                <td colspan="7" style="text-align: center; padding: 40px; color: #6c757d;">
                    <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <h3>No se encontraron productos</h3>
                    <p>No hay resultados para "<strong>${searchTerm}</strong>"</p>
                    <small>Intenta con otros términos de búsqueda</small>
                </td>
            `;
            tableBody.appendChild(noResultsRow);
        }
    }
}

async function addProduct() {
    const form = document.getElementById('productForm');
    const formData = new FormData(form);
    
    // Validar campos requeridos
    const nombre = formData.get('nombre');
    const categoria = formData.get('categoria');
    const precio = formData.get('precio');
    const cantidad = formData.get('cantidad');
    
    if (!nombre || !categoria || !precio || !cantidad) {
        showNotification('Por favor completa todos los campos requeridos', 'error');
        return;
    }
    
    const product = {
        nombre: nombre,
        descripcion: formData.get('descripcion'),
        categoria: categoria,
        precio: parseFloat(precio),
        cantidad: parseInt(cantidad),
        proveedor: formData.get('proveedor')
    };
    
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(product)
        });
        
        if (response.ok) {
            form.reset();
            loadInventory();
            loadDashboardData();
            showNotification('✅ Producto agregado exitosamente', 'success');
            
            // Limpiar búsqueda si existe
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
                filterInventory('');
            }
        } else {
            const errorData = await response.json();
            showNotification(errorData.error || 'Error al agregar producto', 'error');
        }
    } catch (error) {
        console.error('Error agregando producto:', error);
        showNotification('Error de conexión al agregar producto', 'error');
    }
}

async function deleteProduct(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
        try {
            const response = await fetch(`/api/products/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                loadInventory();
                loadDashboardData();
                showNotification('✅ Producto eliminado exitosamente', 'success');
            } else {
                const errorData = await response.json();
                showNotification(errorData.error || 'Error al eliminar producto', 'error');
            }
        } catch (error) {
            console.error('Error eliminando producto:', error);
            showNotification('Error de conexión al eliminar producto', 'error');
        }
    }
}

function viewProduct(id) {
    // Implementar vista detallada del producto
    showNotification(`Vista del producto ${id} - Función en desarrollo`, 'info');
}

function editProduct(id) {
    // Implementar edición del producto
    showNotification(`Editar producto ${id} - Función en desarrollo`, 'info');
}

// Sistema de notificaciones mejorado
function showNotification(message, type = 'info') {
    // Crear contenedor de notificaciones si no existe
    let container = document.getElementById('notificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
        color: white;
        padding: 16px 20px;
        margin-bottom: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' :
                 type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    notification.innerHTML = `
        <i class="fas ${icon}" style="font-size: 20px;"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    
    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
    
    // Agregar estilos de animación si no existen
    if (!document.getElementById('notificationStyles')) {
        const styles = document.createElement('style');
        styles.id = 'notificationStyles';
        styles.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Funciones auxiliares para el servidor (simuladas)
function simulateServerResponse(data, delay = 1000) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(data), delay);
    });
}

// Exportar funciones para uso global (necesario para los onclick en HTML)
window.viewProduct = viewProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.filterInventory = filterInventory;