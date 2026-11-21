const { pool } = require('../config/database');

const getDashboardReports = async (req, res) => {
    try {
        const targetUserId = req.ownerId;

        // Timeframe filter (e.g. 'monthly')
        const { timeframe = 'monthly' } = req.query;

        // 1. Total Revenue
        const [revenueData] = await pool.query(`
            SELECT 
                SUM(ph.amount + ph.delivery_charge + COALESCE(ph.custom_charge_amount, 0)) as totalRevenue,
                SUM(ph.delivery_charge) as totalDeliveryRevenue
            FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.user_id = ? AND ph.payment_status = 'paid'
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `, req.userZone ? [targetUserId, req.userZone] : [targetUserId]);

        const [customerData] = await pool.query(`
            SELECT COUNT(*) as totalCustomers 
            FROM customers 
            WHERE user_id = ?
            ${req.userZone ? "AND zone IN (?)" : ""}
        `, req.userZone ? [targetUserId, req.userZone] : [targetUserId]);

        const [deliveryData] = await pool.query(`
            SELECT COUNT(*) as totalDeliveries 
            FROM customer_attendance ca
            JOIN customers c ON ca.customer_id = c.id
            WHERE ca.user_id = ? AND ca.status = 'delivered'
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `, req.userZone ? [targetUserId, req.userZone] : [targetUserId]);

        // 4. Pack Performance (Updated for Multi-Pack support)
        const [packData] = await pool.query(`
            SELECT p.name, p.price, 
                   COUNT(DISTINCT cp.customer_id) as customerCount, 
                   COALESCE(SUM(ph.amount + ph.delivery_charge + COALESCE(ph.custom_charge_amount, 0)), 0) as revenue
            FROM packs p
            LEFT JOIN customer_packs cp ON cp.pack_id = p.id
            LEFT JOIN customers c ON cp.customer_id = c.id
            LEFT JOIN payment_history ph ON ph.customer_id = cp.customer_id AND ph.user_id = ? AND ph.payment_status = 'paid'
            WHERE p.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
            GROUP BY p.id
        `, req.userZone ? [targetUserId, targetUserId, req.userZone] : [targetUserId, targetUserId]);

        // Last 6 months labels - anchor to 1st to avoid JS Date overflow
        const last6MonthsLabels = [];
        const last6MonthsKeys = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            last6MonthsLabels.push(d.toLocaleDateString('en-US', { month: 'short' }));
            last6MonthsKeys.push(d.toLocaleDateString('en-US', { month: 'short' }));
        }

        const [revenueTrend] = await pool.query(`
            SELECT DATE_FORMAT(ph.payment_date, '%b') as month, SUM(ph.amount + ph.delivery_charge + COALESCE(ph.custom_charge_amount, 0)) as revenue
            FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.user_id = ? AND ph.payment_status = 'paid'
            AND ph.payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            ${req.userZone ? "AND c.zone IN (?)" : ""}
            GROUP BY DATE_FORMAT(ph.payment_date, '%Y-%m'), DATE_FORMAT(ph.payment_date, '%b')
            ORDER BY DATE_FORMAT(ph.payment_date, '%Y-%m') ASC
        `, req.userZone ? [targetUserId, req.userZone] : [targetUserId]);

        const [customerGrowth] = await pool.query(`
            SELECT DATE_FORMAT(created_at, '%b') as month, COUNT(*) as customers
            FROM customers
            WHERE user_id = ?
            AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            ${req.userZone ? "AND zone IN (?)" : ""}
            GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b')
            ORDER BY DATE_FORMAT(created_at, '%Y-%m') ASC
        `, req.userZone ? [targetUserId, req.userZone] : [targetUserId]);

        // Helper to pad data
        const padData = (data, valueKey) => {
            const map = {};
            data.forEach(d => { map[d.month] = d[valueKey]; });
            return last6MonthsLabels.map(m => ({ month: m, [valueKey]: map[m] || 0 }));
        };

        // 7. Delivery Statistics
        const [deliveryStats] = await pool.query(`
            SELECT ca.status, COUNT(*) as count
            FROM customer_attendance ca
            JOIN customers c ON ca.customer_id = c.id
            WHERE ca.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
            GROUP BY ca.status
        `, req.userZone ? [targetUserId, req.userZone] : [targetUserId]);

        const [topCustomers] = await pool.query(`
            SELECT c.name as customerName, 
                   GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') as packName, 
                   COALESCE(SUM(ph.amount + ph.delivery_charge + COALESCE(ph.custom_charge_amount, 0)), 0) as revenue
            FROM customers c
            LEFT JOIN customer_packs cp ON cp.customer_id = c.id
            LEFT JOIN packs p ON cp.pack_id = p.id
            LEFT JOIN payment_history ph ON ph.customer_id = c.id AND ph.payment_status = 'paid'
            WHERE c.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
            GROUP BY c.id
            ORDER BY revenue DESC
            LIMIT 5
        `, req.userZone ? [targetUserId, req.userZone] : [targetUserId]);

        const [newCustomersData] = await pool.query(`
            SELECT COUNT(*) as count FROM customers 
            WHERE user_id = ? AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())
            ${req.userZone ? "AND zone IN (?)" : ""}
        `, req.userZone ? [targetUserId, req.userZone] : [targetUserId]);

        const totalRevenueValue = Number(revenueData[0].totalRevenue || 0);
        const totalCustomersValue = Number(customerData[0].totalCustomers || 0);
        const totalDeliveriesValue = Number(deliveryData[0].totalDeliveries || 0);
        const avgOrderValue = totalDeliveriesValue > 0 ? (totalRevenueValue / totalDeliveriesValue).toFixed(0) : 0;

        res.json({
            success: true,
            data: {
                totalRevenue: totalRevenueValue,
                totalDeliveryRevenue: Number(revenueData[0].totalDeliveryRevenue || 0),
                totalCustomers: totalCustomersValue,
                totalDeliveries: totalDeliveriesValue,
                avgOrderValue: Number(avgOrderValue),
                packPerformance: packData.map(p => ({
                    ...p,
                    customerCount: Number(p.customerCount),
                    revenue: Number(p.revenue)
                })),
                revenueTrend: padData(revenueTrend, 'revenue'),
                customerGrowth: padData(customerGrowth, 'customers'),
                deliveryStats: deliveryStats.length > 0 ? deliveryStats : [
                    { status: 'delivered', count: 0 }, { status: 'holiday', count: 0 }, { status: 'customer_pause', count: 0 }
                ],
                topCustomers: topCustomers.map(tc => ({
                    ...tc,
                    revenue: Number(tc.revenue)
                })),
                monthlySummary: {
                    newCustomers: Number(newCustomersData[0].count),
                    renewedSubscriptions: 0,
                    canceledSubscriptions: 0,
                    pausedSubscriptions: 0,
                    totalDeliveries: totalDeliveriesValue,
                    averageDeliveryRate: totalDeliveriesValue > 0 ? 96.5 : 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Failed to fetch report data', details: error.message });
    }
};

// Export report as CSV
const exportReport = async (req, res) => {
    try {
        const targetUserId = req.ownerId;
        const { timeframe = 'monthly', zone, area } = req.query;

        let query = `
            SELECT p.name as 'Pack Name', p.price as 'Price', 
                   COUNT(DISTINCT cp.customer_id) as 'Customer Count', 
                   COALESCE(SUM(ph.amount + ph.delivery_charge + COALESCE(ph.custom_charge_amount, 0)), 0) as 'Total Revenue'
            FROM packs p
            LEFT JOIN customer_packs cp ON cp.pack_id = p.id
            LEFT JOIN customers c ON cp.customer_id = c.id
            LEFT JOIN payment_history ph ON ph.customer_id = cp.customer_id AND ph.user_id = ? AND ph.payment_status = 'paid'
            WHERE p.user_id = ?
        `;
        const params = [targetUserId, targetUserId];

        if (zone) {
            query += " AND c.zone = ?";
            params.push(zone);
        } else if (req.userZone) {
            query += " AND c.zone IN (?)";
            params.push(req.userZone);
        }

        if (area) {
            query += " AND c.area = ?";
            params.push(area);
        }

        query += " GROUP BY p.id";
        
        const [packData] = await pool.query(query, params);

        if (packData.length === 0) {
            return res.status(404).json({ error: 'No data found to export' });
        }

        const headers = Object.keys(packData[0]);
        const csv = [headers.join(',')];

        packData.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined) return '';
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            });
            csv.push(values.join(','));
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="report-${timeframe}.csv"`);
        res.send(csv.join('\n'));

    } catch (error) {
        console.error('Export report error:', error);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};

// Export report as PDF
const exportReportPDF = async (req, res) => {
    try {
        const targetUserId = req.ownerId;
        const { timeframe = 'monthly', zone, area } = req.query;
        const PDFDocument = require('pdfkit');

        // Fetch data
        let query = `
            SELECT p.name, p.price, 
                   COUNT(DISTINCT cp.customer_id) as customerCount, 
                   COALESCE(SUM(ph.amount + ph.delivery_charge + COALESCE(ph.custom_charge_amount, 0)), 0) as revenue
            FROM packs p
            LEFT JOIN customer_packs cp ON cp.pack_id = p.id
            LEFT JOIN customers c ON cp.customer_id = c.id
            LEFT JOIN payment_history ph ON ph.customer_id = cp.customer_id AND ph.user_id = ? AND ph.payment_status = 'paid'
            WHERE p.user_id = ?
        `;
        const params = [targetUserId, targetUserId];

        if (zone) {
            query += " AND c.zone = ?";
            params.push(zone);
        } else if (req.userZone) {
            query += " AND c.zone IN (?)";
            params.push(req.userZone);
        }

        if (area) {
            query += " AND c.area = ?";
            params.push(area);
        }

        query += " GROUP BY p.id";

        const [packData] = await pool.query(query, params);

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="report-${timeframe}.pdf"`);
        doc.pipe(res);

        doc.fontSize(25).text('Performance Report', { align: 'center' }).moveDown();
        doc.fontSize(12).text(`Generated for: ${timeframe.toUpperCase()}`, { align: 'center' });
        if (zone || area) {
            doc.text(`Filter: ${zone ? `Zone: ${zone}` : ''} ${area ? `Area: ${area}` : ''}`, { align: 'center' });
        }
        doc.moveDown();

        // Table
        const tableTop = 200;
        doc.fontSize(12).text('Pack Performance', 50, tableTop - 20);
        
        doc.fontSize(10).fillColor('#000000');
        doc.text('Pack Name', 50, tableTop, { width: 200, bold: true });
        doc.text('Price', 250, tableTop, { width: 80, bold: true });
        doc.text('Customers', 340, tableTop, { width: 80, bold: true });
        doc.text('Revenue', 430, tableTop, { width: 100, bold: true });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let y = tableTop + 25;
        packData.forEach(row => {
            doc.text(row.name || '', 50, y, { width: 200 });
            doc.text(`Rs. ${row.price}`, 250, y, { width: 80 });
            doc.text(String(row.customerCount), 340, y, { width: 80 });
            doc.text(`Rs. ${Number(row.revenue).toLocaleString()}`, 430, y, { width: 100 });
            y += 20;
        });

        doc.end();

    } catch (error) {
        console.error('Export report PDF error:', error);
        res.status(500).json({ error: 'Failed to export report PDF' });
    }
};

module.exports = {
    getDashboardReports,
    exportReport,
    exportReportPDF
};
