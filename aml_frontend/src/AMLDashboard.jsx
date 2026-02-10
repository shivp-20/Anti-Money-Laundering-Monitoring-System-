import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Users, DollarSign, Search, Filter, Download, Eye, RefreshCw, Calendar, Upload, Play, X, ChevronRight, Activity, Target, Shield, Bell, BarChart3, PieChart, Clock, CheckCircle, XCircle, AlertCircle, FileText, Zap, TrendingDown, User } from 'lucide-react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LogOut, LineChart as LineIcon, PieChart as PieIcon, BarChart3 as BarIcon, ShieldAlert, Globe, ArrowDownRight, ArrowUpRight, ShieldCheck, Fingerprint, Network, Gavel, UserCheck, AlertOctagon, History, ChevronDown } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart as RePieChart, Pie, Cell, Legend, AreaChart, Area,
    BarChart, Bar
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AMLDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    // Derive activeTab from URL path
    const activeTab = location.pathname === '/' ? 'overview' : location.pathname.substring(1);
    const setActiveTab = (tab) => navigate(tab === 'overview' ? '/' : `/${tab}`);

    const [selectedAlert, setSelectedAlert] = useState(() => {
        const saved = localStorage.getItem('lastInvestigatedAlert');
        return saved ? JSON.parse(saved) : null;
    });
    const [dateRange, setDateRange] = useState('7days');
    const [searchTerm, setSearchTerm] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [processedRecords, setProcessedRecords] = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const [activeTaskId, setActiveTaskId] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [animateStats, setAnimateStats] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [riskFilter, setRiskFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [generatingSar, setGeneratingSar] = useState(false);
    const [sarReport, setSarReport] = useState(null);
    const [showSarModal, setShowSarModal] = useState(false);
    const [activeStatusMenu, setActiveStatusMenu] = useState(null);
    const [typologyFilter, setTypologyFilter] = useState('all');

    // Account Investigation State
    const [accountData, setAccountData] = useState(null);
    const [accountTransactions, setAccountTransactions] = useState([]);
    const [loadingAccount, setLoadingAccount] = useState(false);

    // Processed analysis data
    const analysisContext = React.useMemo(() => {
        if (!accountTransactions || accountTransactions.length === 0) {
            return {
                timeline: [20, 45, 10, 80, 95, 30, 15, 60, 40, 5, 20, 85, 90, 10], // Fallback
                sources: ['ACC-SRC-991', 'ACC-SRC-282', 'ACC-SRC-103'],
                destinations: ['ACC-DEST-442', 'ACC-DEST-119']
            };
        }

        // Timeline processing
        const sortedTxns = [...accountTransactions].sort((a, b) => new Date(a.date_time) - new Date(b.date_time));
        const timelineBuckets = Array(14).fill(0);
        if (sortedTxns.length > 1) {
            const start = new Date(sortedTxns[0].date_time).getTime();
            const end = new Date(sortedTxns[sortedTxns.length - 1].date_time).getTime();
            const span = (end - start) || 1;
            sortedTxns.forEach(t => {
                const idx = Math.min(13, Math.floor(((new Date(t.date_time).getTime()) - start) / span * 14));
                timelineBuckets[idx]++;
            });
        }
        const maxBucket = Math.max(...timelineBuckets) || 1;
        const timeline = timelineBuckets.map(b => (b / maxBucket) * 100);

        // Source/Destination processing
        const s = [...new Set(accountTransactions
            .filter(t => t.type && (t.type.toLowerCase().includes('deposit') || t.type.toLowerCase().includes('incoming') || t.type.toLowerCase().includes('credit')))
            .map(t => t.related_account)
            .filter(id => id && id !== 'DIRECT-INTAKE' && id !== selectedAlert?.accountId)
        )].slice(0, 3);

        const d = [...new Set(accountTransactions
            .filter(t => t.type && (t.type.toLowerCase().includes('withdrawal') || t.type.toLowerCase().includes('outgoing') || t.type.toLowerCase().includes('debit')))
            .map(t => t.related_account)
            .filter(id => id && id !== 'DIRECT-INTAKE' && id !== selectedAlert?.accountId)
        )].slice(0, 3);

        return {
            timeline,
            sources: s.length > 0 ? s : ['DIRECT-INTAKE', 'CASH-DEPOSIT'],
            destinations: d.length > 0 ? d : ['LIQUIDATION-PENDING', 'ATM-WITHDRAWAL']
        };
    }, [accountTransactions, selectedAlert]);

    // Data state
    const [alerts, setAlerts] = useState([]);
    const [stats, setStats] = useState({
        critical_alerts: 0,
        flagged_accounts: 0,
        suspicious_volume: '0',
        detection_rate: '0%',
        trend: [],
        distribution: [],
        summary: {
            total_accounts: 0,
            total_transactions: 0,
            total_alerts: 0
        }
    });
    const [recentActivity, setRecentActivity] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const alertsRes = await axios.get('http://localhost:8000/api/alerts/');
            setAlerts(alertsRes.data);

            const statsRes = await axios.get('http://localhost:8000/api/alerts/stats/');
            setStats(statsRes.data);

            const feed = alertsRes.data.map(a => ({
                time: a.time,
                account: a.accountId,
                type: a.type,
                amount: a.amount,
                risk: a.risk_score > 90 ? 'high' : 'medium'
            })).slice(0, 5);
            setRecentActivity(feed);

        } catch (error) {
            console.error("Error fetching data:", error);
            addNotification('Failed to fetch data from backend', 'error');
        }
    };

    useEffect(() => {
        setAnimateStats(true);
        const timer = setTimeout(() => setAnimateStats(false), 1000);

        // Auto-fetch analysis data if we have a persisted alert but no data
        if (activeTab === 'analysis' && selectedAlert && !accountData && !loadingAccount) {
            fetchAccountAnalysis(selectedAlert.accountId);
        }

        return () => clearTimeout(timer);
    }, [activeTab, selectedAlert]);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            setUploadedFile(file);
            addNotification('File uploaded successfully!', 'success');
        }
    };

    const handleRunAnalysis = async () => {
        if (!uploadedFile) return;

        setIsProcessing(true);
        setProcessingProgress(0);
        setProcessedRecords(0);
        setTotalRecords(0);

        const formData = new FormData();
        formData.append('file', uploadedFile);

        try {
            console.log("Starting analysis for file:", uploadedFile.name);
            const token = localStorage.getItem('access_token');

            if (!token) {
                addNotification('Session expired. Please login again.', 'error');
                logout(); // From useAuth hook
                return;
            }

            const response = await axios.post('http://localhost:8000/api/upload/', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 60000
            });

            const { task_id } = response.data;
            setActiveTaskId(task_id);
            addNotification('Analysis started in background...', 'info');

            // Start polling
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await axios.get(`http://localhost:8000/api/task-status/${task_id}/`);
                    const { status, progress, processed_records, total_records, error } = statusRes.data;

                    setProcessingProgress(progress);
                    setProcessedRecords(processed_records);
                    setTotalRecords(total_records);

                    if (status === 'Completed') {
                        clearInterval(pollInterval);
                        setIsProcessing(false);
                        setActiveTaskId(null);
                        fetchData();
                        addNotification('Analysis complete! Dashboard updated.', 'success');
                        setActiveTab('alerts');
                    } else if (status === 'Failed') {
                        clearInterval(pollInterval);
                        setIsProcessing(false);
                        setActiveTaskId(null);
                        addNotification(`Analysis failed: ${error}`, 'error');
                    }
                } catch (err) {
                    console.error("Polling error:", err);
                }
            }, 1000);

        } catch (error) {
            console.error("Upload failed:", error);
            addNotification('Upload failed: ' + (error.response?.data?.error || error.message), 'error');
            setIsProcessing(false);
        }
    };

    const handleGenerateSAR = async (alertId) => {
        setGeneratingSar(true);
        addNotification('Generating AI SAR Report using RAG...', 'info');
        try {
            const response = await axios.post(`http://localhost:8000/api/generate-sar/${alertId}/`);
            setSarReport(response.data.report);
            setShowSarModal(true);
            addNotification('SAR Report generated successfully!', 'success');
        } catch (error) {
            console.error("SAR Generation failed:", error);
            const msg = error.response?.data?.error || error.message || 'Failed to generate SAR report';
            addNotification(`SAR Generation Failed: ${msg}`, 'error');
        } finally {
            setGeneratingSar(false);
        }
    };

    const fetchAccountAnalysis = async (accountId) => {
        setLoadingAccount(true);
        // Do NOT reset accountData here yet to avoid flicker if we have cached data

        try {
            console.log(`Fetching deep analysis for account: ${accountId}`);

            // Artificial delay for effect (optional)
            await new Promise(r => setTimeout(r, 600));

            const [accRes, txnRes] = await Promise.all([
                axios.get(`http://localhost:8000/api/accounts/${accountId}/`).catch(e => null),
                axios.get(`http://localhost:8000/api/accounts/${accountId}/transactions/`).catch(e => null)
            ]);

            if (accRes && accRes.data) {
                setAccountData(accRes.data);
            } else {
                // FALLBACK if account endpoint fails: Use alert data + mock profile
                console.warn("Account API failed, using fallback data");
                setAccountData({
                    account_id: accountId,
                    name: selectedAlert?.accountName || "Unknown Subject",
                    risk_score: selectedAlert?.risk_score || 0,
                    // Add other mock fields needed for UI
                });
            }

            if (txnRes && txnRes.data) {
                setAccountTransactions(txnRes.data);
            } else {
                setAccountTransactions([]);
            }

            console.log("Deep analysis data loaded");
        } catch (error) {
            console.error("Failed to fetch account analysis:", error);
            addNotification('Failed to load investigation data', 'error');
            // Fallback purely to prevent crash
            setAccountData({
                account_id: accountId,
                name: selectedAlert?.accountName || "Unknown Subject",
                risk_score: selectedAlert?.risk_score || 0,
            });
        } finally {
            setLoadingAccount(false);
        }
    };

    const investigateAlert = (alert) => {
        setSelectedAlert(alert);
        localStorage.setItem('lastInvestigatedAlert', JSON.stringify(alert));
        fetchAccountAnalysis(alert.accountId);
        setActiveTab('analysis');
    };

    const updateAlertStatus = async (alertId, newStatus) => {
        try {
            await axios.patch(`http://localhost:8000/api/alerts/${alertId}/`, { status: newStatus });
            setAlerts(prev => prev.map(a =>
                a.id === alertId ? { ...a, status: newStatus } : a
            ));
            setActiveStatusMenu(null);

            if (newStatus === 'Closed') {
                addNotification(`Case ${alertId} closed.`, 'success');
            } else {
                addNotification(`Status updated to ${newStatus}`, 'info');
            }
        } catch (error) {
            console.error("Status update failed:", error);
            addNotification('Failed to update status', 'error');
        }
    };

    const addNotification = (message, type) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    const filteredAlerts = alerts.filter(alert => {
        const matchesSearch = alert.accountId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            alert.alert_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            alert.accountName?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRisk = riskFilter === 'all' ||
            (riskFilter === 'critical' && alert.risk_score >= 90) ||
            (riskFilter === 'high' && alert.risk_score >= 76 && alert.risk_score < 90);
        const matchesStatus = statusFilter === 'all' || alert.status?.toLowerCase().replace(' ', '-') === statusFilter;
        const matchesTypology = typologyFilter === 'all' || alert.type?.includes(typologyFilter);

        return matchesSearch && matchesRisk && matchesStatus && matchesTypology;
    });

    const StatCard = ({ icon: Icon, label, value, color, change, trend }) => (
        <div className="bg-white rounded-2xl shadow-lg p-6 transform transition-all hover:scale-105 hover:shadow-2xl border border-gray-100 group relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity" style={{ backgroundColor: color }}></div>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                    <h3 className="text-3xl font-black text-gray-900 group-hover:text-blue-600 transition-colors tracking-tight">{value}</h3>
                    {change !== undefined && (
                        <div className="flex items-center gap-2 mt-2">
                            {change > 0 ? <TrendingUp size={16} className="text-red-500" /> : <TrendingDown size={16} className="text-green-500" />}
                            <p className={`text-[10px] font-black uppercase tracking-tight ${change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {Math.abs(change)}% vs Prev Week
                            </p>
                        </div>
                    )}
                </div>
                <div className="p-4 rounded-2xl shadow-inner transform transition-transform group-hover:rotate-6" style={{ backgroundColor: `${color}15` }}>
                    <Icon size={32} color={color} strokeWidth={2.5} />
                </div>
            </div>
            {trend && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex justify-between text-xs text-gray-500">
                        {trend.map((val, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <div className="h-12 w-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="bg-gradient-to-t rounded-full transition-all duration-500"
                                        style={{
                                            height: `${val}%`,
                                            backgroundImage: `linear-gradient(to top, ${color}, ${color}80)`
                                        }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
            <div className="fixed inset-0 opacity-5 pointer-events-none">
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, gray 1px, transparent 0)',
                    backgroundSize: '40px 40px'
                }}></div>
            </div>

            <div className="fixed top-4 right-4 z-50 space-y-2">
                {notifications.map(notif => (
                    <div key={notif.id}
                        className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transform transition-all duration-500 slide-in ${notif.type === 'success' ? 'bg-green-500' : notif.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                            } text-white`}>
                        {notif.type === 'success' ? <CheckCircle size={20} /> : notif.type === 'error' ? <XCircle size={20} /> : <Activity size={20} />}
                        <span className="font-semibold">{notif.message}</span>
                    </div>
                ))}
            </div>

            <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer"></div>
                </div>
                <div className="max-w-7xl mx-auto p-8 relative z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white bg-opacity-20 rounded-2xl backdrop-blur-md border border-white/30 shadow-inner group">
                                <ShieldCheck size={40} className="text-white transform group-hover:rotate-12 transition-transform" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">AML Monitoring System</h1>
                                <p className="text-blue-200 mt-1 text-lg font-medium opacity-90">Intelligent Financial Integrity & Compliance Shield</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="mr-4 text-right hidden md:block">
                                <p className="text-sm text-blue-200">Logged in as</p>
                                <p className="font-bold text-white">{user?.username}</p>
                            </div>
                            <button onClick={() => { fetchData(); addNotification('Data refreshed!', 'success'); }}
                                className="bg-white bg-opacity-20 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-semibold hover:bg-opacity-30 transition-all flex items-center gap-2 transform hover:scale-105">
                                <RefreshCw size={20} />
                                Refresh
                            </button>
                            <button onClick={logout}
                                className="bg-white bg-opacity-20 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-semibold hover:bg-red-500/40 transition-all flex items-center gap-2 transform hover:scale-105">
                                <LogOut size={20} />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow-lg sticky top-0 z-40">
                <div className="max-w-7xl mx-auto">
                    <div className="flex gap-2 p-4">
                        {[
                            { id: 'overview', icon: Activity, label: 'Overview' },
                            { id: 'alerts', icon: AlertTriangle, label: 'Alerts', badge: filteredAlerts.filter(a => a.status === 'Open').length },
                            { id: 'analysis', icon: BarChart3, label: 'Deep Analysis' },
                            { id: 'upload', icon: Upload, label: 'Upload & Process' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 ${activeTab === tab.id
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <tab.icon size={20} />
                                {tab.label}
                                {tab.badge > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce">
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6 relative z-10">
                {activeTab === 'overview' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard icon={AlertTriangle} label="Critical Alerts" value={stats.critical_alerts} color="#dc2626" />
                            <StatCard icon={Users} label="Flagged Accounts" value={stats.flagged_accounts} color="#f59e0b" />
                            <StatCard icon={DollarSign} label="Suspicious Volume" value={stats.suspicious_volume} color="#3b82f6" />
                            <StatCard icon={Target} label="Detection Rate" value={stats.detection_rate} color="#10b981" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                            {/* Detailed Trend Analysis */}
                            <div className="bg-white rounded-2xl shadow-xl p-8 transform transition-all hover:shadow-2xl">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <LineIcon size={24} className="text-blue-600" />
                                            Alert Generation Trend
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">Daily suspicious activity alerts (Last 7 Days)</p>
                                    </div>
                                    <div className="flex bg-blue-50 rounded-lg p-1">
                                        <button className="px-3 py-1 bg-white text-blue-600 rounded-md text-xs font-bold shadow-sm">Daily</button>
                                        <button className="px-3 py-1 text-gray-500 text-xs font-semibold">Weekly</button>
                                    </div>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats.trend || []}>
                                            <defs>
                                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                            <RechartsTooltip
                                                contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Exposure by Account Type */}
                            <div className="bg-white rounded-2xl shadow-xl p-8 transform transition-all hover:shadow-2xl">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <PieIcon size={24} className="text-indigo-600" />
                                            Exposure by Account Type
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">Risk density across product lines</p>
                                    </div>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RePieChart>
                                            <Pie
                                                data={stats.acc_type_dist || []}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {(stats.acc_type_dist || []).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={['#6366f1', '#3b82f6', '#10b981', '#f59e0b'][index % 4]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ borderRadius: '12px' }} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </RePieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                            {/* Detection Funnel */}
                            <div className="bg-white rounded-2xl shadow-xl p-8 transform transition-all hover:shadow-2xl">
                                <h3 className="text-xl font-bold mb-8 flex items-center gap-2 text-gray-800">
                                    <BarIcon size={24} className="text-emerald-600" />
                                    Analysis Funnel
                                </h3>
                                <div className="space-y-6">
                                    {[
                                        { label: 'Total Transactions Scanned', val: stats.summary.total_transactions.toLocaleString(), color: 'blue', percent: 100 },
                                        { label: 'Behavioral Flags', val: stats.summary.total_alerts.toLocaleString(), color: 'indigo', percent: (stats.summary.total_alerts / (stats.summary.total_transactions || 1)) * 500 },
                                        { label: 'Critical Risk Accounts', val: stats.critical_alerts, color: 'red', percent: (stats.critical_alerts / (stats.summary.total_alerts || 1)) * 100 }
                                    ].map((step, i) => (
                                        <div key={i} className="relative">
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-sm font-semibold text-gray-600">{step.label}</span>
                                                <span className="text-lg font-bold text-gray-900">{step.val}</span>
                                            </div>
                                            <div className="w-full h-8 bg-gray-50 rounded-lg overflow-hidden flex">
                                                <div
                                                    className={`h-full bg-${step.color}-500 opacity-80 flex items-center px-3 text-white text-[10px] font-bold transition-all duration-1000`}
                                                    style={{ width: `${Math.min(100, step.percent)}%` }}
                                                >
                                                    {Math.min(100, Math.round(step.percent))}%
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-8 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-500 rounded-lg text-white">
                                            <CheckCircle size={20} />
                                        </div>
                                        <p className="text-sm text-emerald-800 font-medium leading-tight">
                                            Your system filtered <span className="font-bold">{stats.summary.total_transactions} txns</span> down to <span className="font-bold">{stats.critical_alerts} actionable</span> threats.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Risk Exposure Profile */}
                            <div className="bg-white rounded-2xl shadow-xl p-8 transform transition-all hover:translate-y-[-4px]">
                                <h3 className="text-xl font-extrabold mb-8 flex items-center gap-2 text-gray-800 border-b pb-4">
                                    <ShieldAlert size={24} className="text-orange-500" />
                                    Risk Exposure Profile
                                </h3>
                                <div className="space-y-5">
                                    {[
                                        { label: 'Critical Tier', count: alerts.filter(a => a.risk_score >= 90).length, percent: alerts.length ? (alerts.filter(a => a.risk_score >= 90).length / alerts.length) * 100 : 0, color: 'red', icon: Zap },
                                        { label: 'High Priority', count: alerts.filter(a => a.risk_score >= 76 && a.risk_score < 90).length, percent: alerts.length ? (alerts.filter(a => a.risk_score >= 76 && a.risk_score < 90).length / alerts.length) * 100 : 0, color: 'orange', icon: TrendingUp },
                                        { label: 'Standard Audit', count: alerts.filter(a => a.risk_score < 76).length, percent: alerts.length ? (alerts.filter(a => a.risk_score < 76).length / alerts.length) * 100 : 0, color: 'blue', icon: Activity }
                                    ].map((tier, idx) => (
                                        <div key={idx} className={`p-4 rounded-2xl bg-${tier.color}-50/50 border border-${tier.color}-100 flex items-center gap-4`}>
                                            <div className={`p-3 bg-${tier.color}-500 rounded-xl text-white shadow-lg shadow-${tier.color}-200`}>
                                                <tier.icon size={20} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-xs font-bold text-gray-600 tracking-tight">{tier.label}</span>
                                                    <span className="text-sm font-black text-gray-900">{tier.count}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-gray-200 rounded-full">
                                                    <div className={`h-1.5 bg-${tier.color}-500 rounded-full`} style={{ width: `${Math.min(100, tier.percent * 3)}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-xl p-6 transform hover:shadow-2xl transition-all h-full flex flex-col">
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <Clock size={24} className="text-blue-500" />
                                    Real-time Threat Stream
                                </h3>
                                <div className="flex-1 space-y-4">
                                    {(stats.impact_feed || []).slice(0, 3).map((item, idx) => (
                                        <div key={idx} className="flex flex-col p-4 rounded-xl bg-gray-50 border border-gray-100 group hover:bg-blue-50 transition-all">
                                            <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                                                <span className="font-bold text-blue-600">{item.account}</span>
                                                <span>{item.time}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-gray-800">Flagged: {item.reason}</span>
                                                <span className="text-sm font-black text-red-600">{item.amount}</span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1 italic">{item.name}</p>
                                        </div>
                                    ))}
                                    {(!stats.impact_feed || stats.impact_feed.length === 0) && (
                                        <div className="text-center py-8 opacity-40">
                                            <ShieldCheck size={32} className="mx-auto mb-2" />
                                            <p className="text-xs font-bold uppercase tracking-widest">No Active Threats</p>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => setActiveTab('alerts')} className="mt-4 w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2">
                                    View Full Audit Feed <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'alerts' && (
                    <div className="space-y-6 animate-fadeIn pb-24">
                        <div className="bg-white rounded-xl shadow-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Filter size={20} className="text-blue-600" />
                                    Search & Filter
                                </h3>
                                <button onClick={() => setShowFilters(!showFilters)}
                                    className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
                                    {showFilters ? 'Hide' : 'Show'} Advanced Filters
                                    <ChevronRight size={16} className={`transform transition-transform ${showFilters ? 'rotate-90' : ''}`} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-2">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-4 text-gray-400" size={20} />
                                        <input
                                            type="text"
                                            placeholder="Search by account, alert ID, or name..."
                                            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <select
                                    className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    value={riskFilter}
                                    onChange={(e) => setRiskFilter(e.target.value)}
                                >
                                    <option value="all">All Risk Levels</option>
                                    <option value="critical">Critical (90+)</option>
                                    <option value="high">High (76-89)</option>
                                </select>
                                <select
                                    className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="all">All Status</option>
                                    <option value="open">Open</option>
                                    <option value="under-review">Under Review</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>

                            {showFilters && (
                                <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4 animate-slideDown">
                                    <select
                                        className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                                        value={typologyFilter}
                                        onChange={(e) => setTypologyFilter(e.target.value)}
                                    >
                                        <option value="all">Pattern Type</option>
                                        <option value="Money Mule">Money Mule</option>
                                        <option value="High Volume">High Volume</option>
                                        <option value="Round Trip">Round Trip</option>
                                        <option value="Structuring">Structuring</option>
                                    </select>
                                    <input type="date" className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" />
                                    <input type="date" className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500" />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {filteredAlerts.length === 0 ? (
                                <div className="bg-white rounded-2xl p-20 text-center border-2 border-dashed border-gray-100">
                                    <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ShieldCheck size={40} className="text-gray-300" />
                                    </div>
                                    <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No alerts matching current filters</p>
                                </div>
                            ) : (
                                filteredAlerts.map((alert, idx) => (
                                    <div key={alert.id || idx}
                                        onClick={() => investigateAlert(alert)}
                                        className="group relative bg-white rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-300 border border-gray-100 overflow-hidden animate-slideIn flex cursor-pointer"
                                        style={{ animationDelay: `${idx * 50}ms` }}>

                                        {/* Severity Accent Bar */}
                                        <div className={`w-1.5 ${alert.risk_score >= 90 ? 'bg-red-600' : 'bg-orange-500'}`}></div>

                                        <div className="flex-1 p-5 flex flex-col gap-4">
                                            {/* Top Row: Header & Status */}
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-4">
                                                    {/* Score */}
                                                    <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl ${alert.risk_score >= 90 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-orange-50 text-orange-700 border border-orange-100'} shadow-sm`}>
                                                        <span className="text-xl font-black">{alert.risk_score}</span>
                                                    </div>

                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-lg font-black text-gray-900 leading-none group-hover:text-blue-600 transition-colors">{alert.accountName}</h4>
                                                            {alert.risk_score >= 90 && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-full">Prohibited</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-xs font-mono font-medium text-gray-400">{alert.account?.account_id || alert.accountId}</p>
                                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{alert.alert_id}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {/* Assignee (Mock) */}
                                                    <div className="hidden md:flex items-center -space-x-2">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-blue-600" title="Assigned Analyst">JD</div>
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-gray-400" title="Unassigned"><Users size={14} /></div>
                                                    </div>

                                                    {/* Status Dropdown */}
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setActiveStatusMenu(activeStatusMenu === alert.id ? null : alert.id); }}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-black text-[10px] uppercase tracking-widest hover:brightness-95 transition-all ${alert.status === 'Open' ? 'bg-red-50 text-red-700 border-red-100' :
                                                                alert.status === 'Under Review' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                                    'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                                }`}
                                                        >
                                                            <div className={`w-1.5 h-1.5 rounded-full ${alert.status === 'Open' ? 'bg-red-500 animate-pulse' : alert.status === 'Under Review' ? 'bg-orange-500' : 'bg-emerald-500'}`}></div>
                                                            {alert.status}
                                                            <ChevronDown size={12} className="ml-1 opacity-50" />
                                                        </button>

                                                        {activeStatusMenu === alert.id && (
                                                            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-[100] overflow-hidden animate-fadeIn">
                                                                {['Open', 'Under Review', 'Closed'].map((status) => (
                                                                    <button
                                                                        key={status}
                                                                        onClick={(e) => { e.stopPropagation(); updateAlertStatus(alert.id, status); }}
                                                                        className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
                                                                    >
                                                                        <div className={`w-2 h-2 rounded-full ${status === 'Open' ? 'bg-red-500' :
                                                                            status === 'Under Review' ? 'bg-orange-500' :
                                                                                'bg-emerald-500'
                                                                            }`} />
                                                                        {status}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Middle Row: Visualization & Metrics */}
                                            <div className="grid grid-cols-12 gap-6 bg-gray-50/50 rounded-xl p-4 border border-gray-50">

                                                {/* 1. Velocity Sparkline */}
                                                <div className="col-span-12 md:col-span-4 flex flex-col justify-center border-r border-gray-100 pr-4">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                        <Activity size={10} /> 7-Day Velocity
                                                    </p>
                                                    <div className="h-12 w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <LineChart data={(alert.trend || [5, 12, 30, 15, 40, 20, 60]).map((val, i) => ({ i, val }))}>
                                                                <Line type="monotone" dataKey="val" stroke={alert.risk_score > 80 ? "#dc2626" : "#f59e0b"} strokeWidth={2} dot={false} />
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>

                                                {/* 2. Red Flags / Typology Tags */}
                                                <div className="col-span-12 md:col-span-5 flex flex-col justify-center px-2">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Detected Patterns</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                                            {alert.type}
                                                        </span>
                                                        {alert.risk_score > 95 && (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
                                                                Rapid Movement
                                                            </span>
                                                        )}
                                                        {alert.amount.length > 7 && (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                                                                High Value
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 3. Financials */}
                                                <div className="col-span-12 md:col-span-3 flex flex-col justify-center items-end border-l border-gray-100 pl-4">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Exposure</p>
                                                    <span className="text-xl font-black text-gray-900 tracking-tight">{alert.amount}</span>
                                                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                                        <Globe size={10} /> International
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Bottom Row: Actions */}
                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                                    <span className="flex items-center gap-1 hover:text-blue-600 cursor-pointer">
                                                        <Clock size={12} /> Last Activity: 2m ago
                                                    </span>
                                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                    <span className="flex items-center gap-1 hover:text-blue-600 cursor-pointer">
                                                        <Shield size={12} /> KYC Verified
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleGenerateSAR(alert.id); }}
                                                        disabled={generatingSar}
                                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${alert.risk_score >= 90
                                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        {generatingSar ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
                                                        Generate SAR
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); investigateAlert(alert); }}
                                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                                                    >
                                                        Investigate <ChevronRight size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'analysis' && (
                    <div className="space-y-6 animate-fadeIn">
                        {!selectedAlert ? (
                            <div className="bg-white rounded-3xl p-32 text-center border-2 border-dashed border-gray-100 flex flex-col items-center justify-center max-w-5xl mx-auto mt-10">
                                <div className="bg-indigo-50 w-28 h-28 rounded-full flex items-center justify-center mb-8 shadow-inner">
                                    <Target size={56} className="text-indigo-300" />
                                </div>
                                <h3 className="text-3xl font-black text-gray-900 mb-4 uppercase tracking-tighter">Case Investigation Nexus</h3>
                                <p className="text-gray-500 max-w-md mb-10 font-medium leading-relaxed text-lg">
                                    Select an entry from the prioritized alerts to initiate a full-spectrum behavioral reconstruction and fund-flow audit.
                                </p>
                                <button onClick={() => setActiveTab('alerts')} className="px-12 py-5 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl shadow-gray-200 active:scale-95">
                                    Access Alert Stream
                                </button>
                            </div>
                        ) : loadingAccount ? (
                            <div className="bg-white rounded-3xl p-32 text-center border border-gray-100 shadow-xl max-w-5xl mx-auto mt-10 animate-pulse">
                                <RefreshCw size={56} className="mx-auto text-indigo-400 animate-spin mb-6" />
                                <p className="text-indigo-600 font-black uppercase tracking-[0.2em] text-sm italic">Synchronizing Transaction Ledger & AI Context...</p>
                            </div>
                        ) : (
                            <div className="max-w-[1600px] mx-auto space-y-6 pb-20">
                                {/* PHASE 1: Premium Account Header */}
                                <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 group">
                                    <div className="bg-slate-900 px-12 py-10 text-white relative">
                                        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-indigo-500/10 to-transparent"></div>
                                        <div className="flex justify-between items-center relative z-10">
                                            <div className="flex items-center gap-10">
                                                <div className="p-6 bg-white/5 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                                    <UserCheck size={42} className="text-indigo-400" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-4 mb-3">
                                                        <h2 className="text-4xl font-black tracking-tight">{accountData?.name || selectedAlert.accountName}</h2>
                                                        <span className="px-5 py-2 bg-indigo-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-indigo-500/30">Active Investigation</span>
                                                    </div>
                                                    <div className="flex items-center gap-8 opacity-60 font-mono text-sm uppercase tracking-widest">
                                                        <span className="flex items-center gap-2"><Fingerprint size={16} /> ID: {selectedAlert.accountId}</span>
                                                        <span className="w-2 h-2 rounded-full bg-white/30"></span>
                                                        <span className="flex items-center gap-2"><FileText size={16} /> Case: {selectedAlert.alert_id}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-12">
                                                <div className="bg-white/5 px-8 py-4 rounded-3xl border border-white/5 backdrop-blur-md">
                                                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-1">Regulatory Deadline</p>
                                                    <p className="font-black text-3xl flex items-center gap-3">
                                                        <Clock size={24} className="text-indigo-400" /> 28d Remaining
                                                    </p>
                                                </div>
                                                <button onClick={() => {
                                                    setSelectedAlert(null);
                                                    localStorage.removeItem('lastInvestigatedAlert');
                                                }} className="p-4 bg-white/5 hover:bg-red-500/20 rounded-2xl transition-all border border-white/10 hover:border-red-500/50">
                                                    <X size={28} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
                                        {/* SIDEBAR: Risk & Typology Diagnostic */}
                                        <div className="lg:col-span-3 space-y-8">
                                            <div className={`p-8 rounded-[2rem] relative overflow-hidden ${selectedAlert.risk_score >= 90 ? 'bg-red-50/50 border-red-100' : 'bg-orange-50/50 border-orange-100'} border-2`}>
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-8 text-center">Behavioral Risk Index</p>
                                                <div className="flex items-center justify-center mb-8 relative">
                                                    <svg className="w-40 h-40 transform -rotate-90">
                                                        <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-gray-100" />
                                                        <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="16" fill="transparent"
                                                            strokeDasharray={452}
                                                            strokeDashoffset={452 - (452 * selectedAlert.risk_score / 100)}
                                                            className={selectedAlert.risk_score >= 90 ? 'text-red-500' : 'text-orange-500'}
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                        <span className="text-5xl font-black text-slate-900">{selectedAlert.risk_score}</span>
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Reg Score</span>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-white rounded-2xl border border-gray-100 text-center shadow-sm">
                                                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${selectedAlert.risk_score >= 90 ? 'text-red-600' : 'text-orange-600'}`}>
                                                        {selectedAlert.risk_score >= 90 ? 'Critical Threat Warning' : 'Suspicious Movement Detect'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Pattern Distribution</h4>
                                                {(selectedAlert.type || "Anomalous Behavior").split(',').map((typ, i) => (
                                                    <div key={i} className="bg-white border border-gray-100 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
                                                        <div className="flex items-center gap-4">
                                                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                                <Network size={20} />
                                                            </div>
                                                            <span className="text-sm font-black text-slate-800">{typ.trim()}</span>
                                                        </div>
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* MAIN: Visual Flow & Timeline */}
                                        <div className="lg:col-span-9 space-y-10">
                                            {/* VISUAL COMPONENT 1: Transaction Flow Map */}
                                            <div className="bg-slate-50 rounded-[2.5rem] border border-gray-200 p-10 relative overflow-hidden">
                                                <div className="flex items-center justify-between mb-12 relative z-10">
                                                    <div>
                                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                                                            <Network size={22} className="text-indigo-600" />
                                                            Fund Flow Reconstruction (Inbound → Outbound)
                                                        </h4>
                                                        <p className="text-xs text-slate-500 font-medium mt-1">Reconstructing the physical path of identified assets</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-600 shadow-sm border border-emerald-100">
                                                            <ArrowDownRight size={14} /> Inflow: ₹{selectedAlert.amount}
                                                        </span>
                                                        <span className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-600 shadow-sm border border-rose-100">
                                                            <ArrowUpRight size={14} /> Outflow Peak
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between relative min-h-[300px] px-10">
                                                    {/* Source Nodes */}
                                                    <div className="space-y-6">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center mb-4">Origins</p>
                                                        {analysisContext.sources.map((id, i) => (
                                                            <div key={i} className="p-4 bg-white border border-gray-100 rounded-2xl w-52 shadow-xl flex items-center gap-3 relative z-10 hover:scale-105 transition-transform">
                                                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                                    <Globe size={16} />
                                                                </div>
                                                                <p className="text-xs font-mono font-black text-slate-800 tracking-tighter">{id}</p>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Central Connector Overlay (SVGs) */}
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <svg className="w-full h-full opacity-20">
                                                            {analysisContext.sources.map((_, i) => (
                                                                <path key={`s-${i}`} d={`M 250 ${100 + i * 80} Q 450 ${200} 650 200`} stroke="#6366f1" strokeWidth="4" fill="none" strokeDasharray="10 10" />
                                                            ))}
                                                            {analysisContext.destinations.map((_, i) => (
                                                                <path key={`d-${i}`} d={`M 950 200 Q 1150 200 1350 ${100 + i * 100}`} stroke="#f59e0b" strokeWidth="4" fill="none" strokeDasharray="10 10" />
                                                            ))}
                                                        </svg>
                                                    </div>

                                                    {/* THE SUBJECT HUB */}
                                                    <div className="relative z-20">
                                                        <div className="w-64 h-64 bg-slate-900 rounded-[3rem] p-4 shadow-2xl ring-[12px] ring-indigo-50 flex flex-col items-center justify-center text-center transform hover:scale-105 transition-all">
                                                            <div className="absolute -top-6 bg-indigo-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl">Subject Account</div>
                                                            <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mb-6">
                                                                <User size={36} className="text-indigo-400" />
                                                            </div>
                                                            <p className="text-xl font-mono font-black text-white tracking-widest mb-1">{selectedAlert.accountId}</p>
                                                            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">Nexus Point</p>
                                                        </div>
                                                    </div>

                                                    {/* Destination Nodes */}
                                                    <div className="space-y-12">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center mb-4">Liquidations</p>
                                                        {analysisContext.destinations.map((id, i) => (
                                                            <div key={i} className="p-5 bg-white border border-gray-100 rounded-2xl w-52 shadow-xl flex items-center gap-4 relative z-10 hover:scale-105 transition-transform border-l-4 border-l-orange-500">
                                                                <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                                                    <ArrowUpRight size={18} />
                                                                </div>
                                                                <p className="text-xs font-mono font-black text-slate-800 tracking-tighter">{id}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* VISUAL COMPONENT 2: Behavioral Velocity Timeline */}
                                            <div className="bg-white rounded-3xl border border-gray-100 p-10 shadow-xl">
                                                <div className="flex items-center justify-between mb-10">
                                                    <div>
                                                        <h4 className="text-sm font-black text-indigo-900 uppercase tracking-[0.2em] flex items-center gap-3">
                                                            <Activity size={22} className="text-indigo-500" />
                                                            Burst Velocity & Temporal Analysis
                                                        </h4>
                                                        <p className="text-xs text-gray-500 font-medium mt-1">Visualizing transaction density peaks in a 48-hour window</p>
                                                    </div>
                                                    <span className="px-5 py-2 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-100 flex items-center gap-2">
                                                        <Zap size={14} /> High Frequency Cluster Detected
                                                    </span>
                                                </div>

                                                <div className="relative h-20 w-full bg-gray-50 rounded-2xl flex items-center px-6 gap-2">
                                                    {analysisContext.timeline.map((val, i) => (
                                                        <div key={i} className="flex-1 flex flex-col justify-end h-12 group cursor-pointer">
                                                            <div
                                                                className={`w-full rounded-full transition-all duration-500 group-hover:scale-x-125 ${val > 80 ? 'bg-red-500 shadow-lg shadow-red-200' :
                                                                    val > 40 ? 'bg-indigo-400' : 'bg-gray-200'
                                                                    }`}
                                                                style={{ height: `${Math.max(20, val)}%` }}
                                                            ></div>
                                                        </div>
                                                    ))}
                                                    <div className="absolute top-full mt-4 left-0 w-full flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                        <span>Start Date</span>
                                                        <span>Active Period</span>
                                                        <span>End Date</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* PHASE 5: The Precise Evidence Ledger */}
                                    <div className="p-12 bg-gray-50/50 border-t border-gray-100">
                                        <div className="flex items-center justify-between mb-10">
                                            <div>
                                                <h4 className="text-2xl font-black text-slate-900 tracking-tighter">Diagnostic Evidence Ledger</h4>
                                                <p className="text-sm text-slate-500 font-medium mt-1">Audit-ready historical trace for Case #{selectedAlert.alert_id}</p>
                                            </div>
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => handleGenerateSAR(selectedAlert.id)}
                                                    disabled={generatingSar}
                                                    className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl shadow-indigo-200 flex items-center gap-3 disabled:bg-gray-400"
                                                >
                                                    {generatingSar ? <RefreshCw className="animate-spin" size={16} /> : <FileText size={18} />}
                                                    Initialize SAR Draft
                                                </button>
                                            </div>
                                        </div>

                                        <div className="overflow-hidden bg-white border border-gray-200 rounded-[2.5rem] shadow-2xl">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-900 text-indigo-300 border-b border-gray-800">
                                                    <tr>
                                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em]">Temporal Stamp</th>
                                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em]">Log Interaction</th>
                                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em]">Account Counterparty</th>
                                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em]">Asset Value</th>
                                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em]">Audit State</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {accountTransactions.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="5" className="px-10 py-24 text-center">
                                                                <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                                                    <History size={36} className="text-gray-300" />
                                                                </div>
                                                                <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Zero historical segments detected in the current window</p>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        accountTransactions.map((txn, idx) => (
                                                            <tr key={idx} className={`hover:bg-indigo-50/20 transition-all font-medium ${txn.flag ? 'bg-rose-50/10' : ''}`}>
                                                                <td className="px-10 py-6">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-mono font-black text-slate-800 tabular-nums">{txn.date_time}</span>
                                                                        <span className="text-[9px] text-indigo-400 font-bold uppercase mt-1 tracking-widest">Trace ID: {idx + 9102}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-10 py-6">
                                                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest ${txn.type.includes('DEPOSIT') ? 'bg-emerald-100/50 text-emerald-700' : 'bg-rose-100/50 text-rose-700'
                                                                        }`}>
                                                                        {txn.type.includes('DEPOSIT') ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                                                                        {txn.type}
                                                                    </div>
                                                                </td>
                                                                <td className="px-10 py-6">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="p-2 bg-slate-50 rounded-xl text-slate-400 border border-slate-100">
                                                                            <Globe size={16} />
                                                                        </div>
                                                                        <span className="text-xs font-black text-slate-700 font-mono italic tracking-tighter">{txn.related_account || 'DIRECT-INTAKE'}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-10 py-6">
                                                                    <span className="text-sm font-black text-slate-900 tabular-nums tracking-tighter">{txn.amount}</span>
                                                                </td>
                                                                <td className="px-10 py-6">
                                                                    {txn.flag ? (
                                                                        <div className="flex items-center gap-3 px-4 py-2 bg-rose-600 text-white rounded-xl shadow-lg shadow-rose-200">
                                                                            <AlertTriangle size={14} />
                                                                            <span className="text-[10px] font-black uppercase tracking-widest">Anomalous</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2 opacity-30 text-slate-400">
                                                                            <CheckCircle size={14} />
                                                                            <span className="text-[10px] font-bold uppercase tracking-widest">Baseline</span>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'upload' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="bg-white rounded-3xl shadow-xl p-10 border border-gray-100 max-w-4xl mx-auto">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                                    <Upload size={32} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Data Ingestion Hub</h3>
                                    <p className="text-gray-500 font-medium">Batch process transaction ledgers for behavioral analysis</p>
                                </div>
                            </div>

                            {!uploadedFile ? (
                                <div
                                    onClick={() => document.querySelector('input[type="file"]').click()}
                                    className="border-4 border-dashed border-gray-100 rounded-3xl p-16 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group"
                                >
                                    <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-inner">
                                        <FileText size={48} className="text-gray-300 group-hover:text-blue-400" />
                                    </div>
                                    <p className="text-xl font-bold text-gray-700 mb-2">Drag behavioral logs here</p>
                                    <p className="text-sm text-gray-400 font-medium">Supports .CSV and .XLSX (Max 250MB)</p>
                                    <input type="file" className="hidden" onChange={handleFileUpload} />
                                    <button className="mt-8 px-10 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-gray-200">
                                        Select Source File
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-8 animate-slideUp">
                                    <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white rounded-xl shadow-sm">
                                                <FileText size={24} className="text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="font-black text-gray-900 leading-none">{uploadedFile.name}</p>
                                                <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-widest">Ready for Behavioral Scan</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setUploadedFile(null)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {!isProcessing ? (
                                        <button
                                            onClick={handleRunAnalysis}
                                            className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:shadow-2xl hover:shadow-blue-200 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3"
                                        >
                                            <Play size={20} fill="currentColor" />
                                            Initialize Risk Engine
                                        </button>
                                    ) : (
                                        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-inner space-y-6">
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Compute in Progress</p>
                                                    <h4 className="text-xl font-black text-gray-900">Scanning for Typologies...</h4>
                                                </div>
                                                <span className="text-3xl font-black text-blue-600">{processingProgress}%</span>
                                            </div>

                                            <div className="w-full bg-gray-100 rounded-full h-4 p-1 shadow-inner overflow-hidden">
                                                <div
                                                    className="bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 h-full rounded-full transition-all duration-700 ease-out shadow-lg"
                                                    style={{ width: `${processingProgress}%` }}
                                                ></div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Records Ingested</p>
                                                    <p className="font-black text-gray-900">{processedRecords.toLocaleString()}</p>
                                                </div>
                                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Target Volume</p>
                                                    <p className="font-black text-gray-900">{totalRecords.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {/* SAR Report Modal */}
            {
                showSarModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slideUp">
                            <div className="p-6 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Shield className="text-blue-200" size={28} />
                                    <div>
                                        <h3 className="text-xl font-bold">AI-Generated Suspicious Activity Report (SAR)</h3>
                                        <p className="text-blue-100 text-sm">Regulatory Document Draft • Powered by Grok LLM & RBI/PMLA RAG</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowSarModal(false)} className="hover:bg-white/20 p-2 rounded-full transition-all">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-8 overflow-y-auto leading-relaxed text-gray-800">
                                <div className="prose max-w-none">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            h1: ({ node, ...props }) => <h1 className="text-3xl font-black text-center mb-6 uppercase border-b-4 border-red-600 pb-4 tracking-widest text-gray-900" {...props} />,
                                            h2: ({ node, ...props }) => <h2 className="text-xl font-black text-blue-900 mt-8 mb-4 border-b border-gray-200 pb-2 uppercase tracking-wide" {...props} />,
                                            h3: ({ node, ...props }) => <h3 className="text-lg font-bold text-gray-800 mt-6 mb-3" {...props} />,
                                            table: ({ node, ...props }) => <table className="min-w-full border-collapse border border-gray-300 my-6 shadow-sm rounded-lg overflow-hidden" {...props} />,
                                            thead: ({ node, ...props }) => <thead className="bg-gray-50 bg-opacity-70" {...props} />,
                                            th: ({ node, ...props }) => <th className="border border-gray-300 px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider" {...props} />,
                                            td: ({ node, ...props }) => <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 font-medium" {...props} />,
                                            blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-red-500 bg-red-50 p-6 rounded-r-xl italic my-6 text-red-900 font-semibold shadow-sm" {...props} />,
                                            strong: ({ node, ...props }) => <strong className="font-black text-gray-900" {...props} />,
                                            hr: ({ node, ...props }) => <hr className="my-8 border-gray-200" {...props} />,
                                        }}
                                    >
                                        {sarReport}
                                    </ReactMarkdown>
                                </div>
                            </div>
                            <div className="p-6 bg-gray-50 border-t flex justify-end gap-4">
                                <button
                                    onClick={() => {
                                        const blob = new Blob([sarReport], { type: 'text/plain' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `SAR_Report_${selectedAlert?.accountId}.txt`;
                                        a.click();
                                    }}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all flex items-center gap-2"
                                >
                                    <Download size={20} />
                                    Download Report
                                </button>
                                <button onClick={() => setShowSarModal(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-all">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default AMLDashboard;
