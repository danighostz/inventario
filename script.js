// script.js - Sistema de Inventario con Autenticación

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

    // Configurar búsqueda
    document.getElementById('searchInput').addEventListener('input', function() {
        filterInventory(this.value);
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
        const response = await fetch('/api/products', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const products = await response.json();
            displayInventory(products);
        }
    } catch (error) {
        console.error('Error cargando inventario:', error);
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
            <tr class="slide-in">
                <td>
                    <strong>${product.nombre}</strong>
                    ${product.descripcion ? `<br><small>${product.descripcion}</small>` : ''}
                </td>
                <td><span class="badge">${product.categoria}</span></td>
                <td>$${product.precio.toFixed(2)}</td>
                <td>
                    <span class="badge ${stockStatus.class}">
                        ${product.cantidad} ${stockStatus.text}
                    </span>
                </td>
                <td>$${totalValue}</td>
                <td>${product.proveedor || 'N/A'}</td>
                <td class="actions">
                    <button class="action-btn view" onclick="viewProduct(${product.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit" onclick="editProduct(${product.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteProduct(${product.id})">
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
}

function getStockStatus(quantity) {
    if (quantity === 0) return { class: 'danger', text: 'Agotado' };
    if (quantity <= 5) return { class: 'warning', text: 'Bajo' };
    return { class: 'success', text: 'Disponible' };
}

async function addProduct() {
    const form = document.getElementById('productForm');
    const formData = new FormData(form);
    
    const product = {
        nombre: formData.get('nombre'),
        descripcion: formData.get('descripcion'),
        categoria: formData.get('categoria'),
        precio: parseFloat(formData.get('precio')),
        cantidad: parseInt(formData.get('cantidad')),
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
            showNotification('Producto agregado exitosamente', 'success');
        }
    } catch (error) {
        showNotification('Error al agregar producto', 'error');
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
                showNotification('Producto eliminado exitosamente', 'success');
            }
        } catch (error) {
            showNotification('Error al eliminar producto', 'error');
        }
    }
}

function filterInventory(searchTerm) {
    const rows = document.querySelectorAll('#inventoryTable tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm.toLowerCase())) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function viewProduct(id) {
    // Implementar vista detallada del producto
    alert(`Vista del producto ${id} - Por implementar`);
}

function editProduct(id) {
    // Implementar edición del producto
    alert(`Editar producto ${id} - Por implementar`);
}

function showNotification(message, type) {
    // Implementar sistema de notificaciones toast
    console.log(`${type.toUpperCase()}: ${message}`);
}

// Funciones auxiliares para el servidor (simuladas)
function simulateServerResponse(data, delay = 1000) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(data), delay);
    });
}