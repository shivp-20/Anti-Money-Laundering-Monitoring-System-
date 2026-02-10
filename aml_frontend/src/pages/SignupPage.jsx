import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, User, Mail, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';

const SignupPage = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signup(username, password, email);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
            <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 relative z-10 animate-fadeIn">
                <div className="flex flex-col items-center mb-8">
                    <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg mb-4 transform hover:-rotate-12 transition-transform">
                        <Shield size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Create Profile</h1>
                    <p className="text-purple-200 mt-2">Join the AML Sentinel network</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 animate-shake">
                        <AlertCircle size={20} />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-purple-200 ml-1">Username</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-300" size={20} />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-purple-300/50 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                                placeholder="Choose a username"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-purple-200 ml-1">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-300" size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-purple-300/50 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                                placeholder="your@email.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-purple-200 ml-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-300" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-purple-300/50 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold py-4 rounded-xl shadow-lg hover:from-purple-600 hover:to-pink-700 transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                    >
                        {loading ? (
                            <RefreshCw className="animate-spin" size={20} />
                        ) : (
                            <>
                                Create Account
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-purple-200 text-sm">
                        Already have an account?{' '}
                        <Link to="/login" className="text-white font-bold hover:underline underline-offset-4">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
