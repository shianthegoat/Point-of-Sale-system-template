let statisticsChart = null;

// Render checkboxes for customers and products
async function populateCheckboxes() {
    // Customers
    const customerBox = document.getElementById('customerCheckboxes');
    customerBox.innerHTML = '';
    const customersData = await window.api.getCustomers();
    if (customersData && customersData.success) {
        const customers = (customersData.customers || []).sort((a, b) => a.name.localeCompare(b.name));
        customers.forEach(cust => {
            const id = 'cust_' + cust.name.replace(/\W/g, '_');
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${cust.name}" id="${id}" class="customer-checkbox"> ${cust.name}`;
            customerBox.appendChild(label);
        });
    }

    // Products grouped by category
    const productBox = document.getElementById('productCheckboxes');
    productBox.innerHTML = '';
    const categoriesData = await window.api.getCategories();
    const inventoryData = await window.api.getInventory();
    if (categoriesData && categoriesData.success && inventoryData && inventoryData.success) {
        const categories = categoriesData.categories || [];
        const inventory = inventoryData.inventory || [];
        categories.sort((a, b) => a.name.localeCompare(b.name));
        categories.forEach(cat => {
            const groupLabel = document.createElement('div');
            groupLabel.style.fontWeight = '600';
            groupLabel.style.marginTop = '8px';
            groupLabel.textContent = cat.name;
            productBox.appendChild(groupLabel);
            inventory.filter(item => item.category === cat.name).forEach(item => {
                const id = 'prod_' + item.name.replace(/\W/g, '_');
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${item.name}" id="${id}" class="product-checkbox"> ${item.name}`;
                productBox.appendChild(label);
            });
        });
    }
}

// Utility to get checked values from a checkbox group
function getCheckedValues(container, className) {
    return Array.from(container.querySelectorAll('input.' + className + ':checked')).map(cb => cb.value);
}

// Fetch and process statistics data
async function fetchStatisticsData() {
    const customerBox = document.getElementById('customerCheckboxes');
    const productBox = document.getElementById('productCheckboxes');
    const selectedCustomers = getCheckedValues(customerBox, 'customer-checkbox');
    const selectedProducts = getCheckedValues(productBox, 'product-checkbox');
    const salesData = await window.api.getSales();
    if (!salesData || !salesData.success) return { sales: [] };
    let sales = salesData.sales || [];
    // Filter by selected customers
    if (selectedCustomers.length > 0) {
        sales = sales.filter(sale => selectedCustomers.includes(sale.customer_name));
    }
    // Filter by selected products
    if (selectedProducts.length > 0) {
        sales = sales.filter(sale => sale.items.some(item => selectedProducts.includes(item.name)));
    }
    return { sales, selectedCustomers, selectedProducts };
}

// Prepare chart data for different visualizations
function prepareChartData(sales, chartType, selectedCustomers, selectedProducts) {
    if (chartType === 'bar') {
        // Bar: Each customer's total spending (optionally per product)
        let labels = [];
        let datasets = [];
        if (selectedProducts.length > 0) {
            // For each product, show spending per customer
            labels = selectedCustomers.length > 0 ? selectedCustomers : Array.from(new Set(sales.map(s => s.customer_name)));
            selectedProducts.forEach(product => {
                const data = labels.map(customer => {
                    // Sum total spent by this customer on this product
                    return sales.filter(sale => sale.customer_name === customer)
                        .reduce((sum, sale) => {
                            const item = sale.items.find(i => i.name === product);
                            return sum + (item ? (item.price * item.quantity) : 0);
                        }, 0);
                });
                datasets.push({
                    label: product,
                    data,
                    backgroundColor: randomColor(product),
                });
            });
        } else {
            // For each customer, show total spending
            labels = selectedCustomers.length > 0 ? selectedCustomers : Array.from(new Set(sales.map(s => s.customer_name)));
            datasets = [{
                label: 'Total Spending',
                data: labels.map(customer => {
                    return sales.filter(sale => sale.customer_name === customer)
                        .reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
                }),
                backgroundColor: '#3498db',
            }];
        }
        return { labels, datasets };
    } else if (chartType === 'pie') {
        // Pie: Most frequently purchased items (across selected customers)
        const itemCounts = {};
        sales.forEach(sale => {
            sale.items.forEach(item => {
                if (selectedProducts.length === 0 || selectedProducts.includes(item.name)) {
                    itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 1);
                }
            });
        });
        return {
            labels: Object.keys(itemCounts),
            datasets: [{
                label: 'Purchase Frequency',
                data: Object.values(itemCounts),
                backgroundColor: Object.keys(itemCounts).map(randomColor)
            }]
        };
    }
    // Default fallback
    return { labels: [], datasets: [] };
}

// Utility: Generate a color for a label
function randomColor(label) {
    // Simple hash to color
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h},70%,60%)`;
}

function renderStatisticsChart(chartData, chartType) {
    const ctx = document.getElementById('statisticsChart').getContext('2d');
    if (statisticsChart) statisticsChart.destroy();
    statisticsChart = new Chart(ctx, {
        type: chartType === 'pie' ? 'pie' : 'bar',
        data: chartData,
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: 'top' },
                datalabels: chartType === 'pie' ? {
                    color: '#fff',
                    formatter: (value, ctx) => {
                        let sum = 0;
                        const dataArr = ctx.chart.data.datasets[0].data;
                        dataArr.forEach(data => { sum += data; });
                        const percentage = ((value * 100) / sum).toFixed(1) + '%';
                        return percentage;
                    }
                } : false
            },
            scales: chartType === 'bar' ? {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Amount (₱)' }
                },
                x: {
                    // Make bars slimmer
                    maxBarThickness: 24
                }
            } : {}
        },
        plugins: chartType === 'pie' ? [ChartDataLabels] : []
    });
}

async function updateStatisticsChart() {
    const chartType = document.getElementById('chartTypeSelector').value;
    const { sales, selectedCustomers, selectedProducts } = await fetchStatisticsData();
    const chartData = prepareChartData(sales, chartType, selectedCustomers, selectedProducts);
    renderStatisticsChart(chartData, chartType);
}

// Event listeners
window.addEventListener('DOMContentLoaded', async () => {
    await populateCheckboxes();
    await updateStatisticsChart();
    document.getElementById('chartTypeSelector').addEventListener('change', updateStatisticsChart);
    document.getElementById('customerCheckboxes').addEventListener('change', updateStatisticsChart);
    document.getElementById('productCheckboxes').addEventListener('change', updateStatisticsChart);
}); 