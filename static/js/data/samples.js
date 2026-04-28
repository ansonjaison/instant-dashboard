/**
 * Sample data sets and corresponding design prompts.
 *
 * Pure data module — no DOM or side-effect dependencies.
 */

export const SAMPLES = {
    sales: JSON.stringify({
        "company": "TechCorp Inc.",
        "quarter": "Q4 2025",
        "total_revenue": 1284500,
        "total_expenses": 892300,
        "net_profit": 392200,
        "profit_margin": "30.5%",
        "departments": [
            { "name": "Engineering", "revenue": 520000, "headcount": 45 },
            { "name": "Sales", "revenue": 480000, "headcount": 32 },
            { "name": "Marketing", "revenue": 184500, "headcount": 18 },
            { "name": "Operations", "revenue": 100000, "headcount": 12 }
        ],
        "monthly_revenue": [
            { "month": "October", "amount": 398000 },
            { "month": "November", "amount": 421500 },
            { "month": "December", "amount": 465000 }
        ],
        "top_products": [
            { "name": "Cloud Suite Pro", "sales": 342, "revenue": 513000 },
            { "name": "Data Analytics", "sales": 218, "revenue": 392400 },
            { "name": "Security Shield", "sales": 189, "revenue": 283500 }
        ]
    }, null, 2),

    analytics: JSON.stringify({
        "website": "dashboard.app",
        "period": "January 2026",
        "visitors": 48230,
        "unique_visitors": 31450,
        "page_views": 142800,
        "bounce_rate": "34.2%",
        "avg_session_duration": "4m 23s",
        "conversion_rate": "3.8%",
        "traffic_sources": [
            { "source": "Organic Search", "visitors": 18720, "percentage": "38.8%" },
            { "source": "Direct", "visitors": 12480, "percentage": "25.9%" },
            { "source": "Social Media", "visitors": 9640, "percentage": "20.0%" },
            { "source": "Referral", "visitors": 4820, "percentage": "10.0%" },
            { "source": "Email", "visitors": 2570, "percentage": "5.3%" }
        ],
        "top_pages": [
            { "page": "/home", "views": 42300, "avg_time": "2m 15s" },
            { "page": "/pricing", "views": 28400, "avg_time": "3m 42s" },
            { "page": "/features", "views": 21800, "avg_time": "2m 58s" },
            { "page": "/docs", "views": 18200, "avg_time": "5m 10s" }
        ],
        "devices": {
            "desktop": "58.3%",
            "mobile": "34.1%",
            "tablet": "7.6%"
        }
    }, null, 2),

    hr: JSON.stringify({
        "organization": "GlobalTech Solutions",
        "report_date": "February 2026",
        "total_employees": 284,
        "new_hires": 12,
        "attrition_rate": "4.2%",
        "avg_tenure": "3.4 years",
        "departments": [
            { "name": "Engineering", "count": 98, "avg_salary": 125000 },
            { "name": "Product", "count": 42, "avg_salary": 115000 },
            { "name": "Sales", "count": 56, "avg_salary": 95000 },
            { "name": "Marketing", "count": 34, "avg_salary": 88000 },
            { "name": "HR & Admin", "count": 28, "avg_salary": 78000 },
            { "name": "Finance", "count": 26, "avg_salary": 105000 }
        ],
        "satisfaction_score": 4.2,
        "diversity": {
            "gender": { "male": "56%", "female": "41%", "non_binary": "3%" },
            "remote_vs_office": { "remote": "62%", "hybrid": "28%", "office": "10%" }
        },
        "open_positions": 8
    }, null, 2)
};

export const SAMPLE_PROMPTS = {
    sales: 'Create a professional dark-themed executive dashboard with gradient KPI cards for revenue, expenses, and profit. Show department breakdown as a styled table and highlight top products with bold typography.',
    analytics: 'Design a modern analytics dashboard with a clean white and blue color scheme. Use card-based layout for key metrics, display traffic sources in a visually distinct table, and show top pages with session times.',
    hr: 'Build a corporate HR dashboard with a warm, professional palette. Feature employee stats as large KPI tiles, department breakdown in a clean table, and visualize diversity and work-mode split with clear sections.'
};
