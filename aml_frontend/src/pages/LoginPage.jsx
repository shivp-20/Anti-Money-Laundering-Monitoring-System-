import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, User, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, googleLogin } = useAuth();
    const navigate = useNavigate();

    const handleGoogleSuccess = async (credentialResponse) => {
        setError('');
        setLoading(true);
        try {
            await googleLogin(credentialResponse.credential);
            navigate('/');
        } catch (err) {
            setError('Google login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Google login failed. Please try again.');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.detail || 'Invalid username or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center p-6">
            <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 relative z-10 animate-fadeIn">
                <div className="flex flex-col items-center mb-8">
                    <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-4 transform hover:rotate-12 transition-transform">
                        <Shield size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h1>
                    <p className="text-blue-200 mt-2">Sign in to access AML Sentinel</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 animate-shake">
                        <AlertCircle size={20} />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-blue-200 ml-1">Username</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={20} />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-blue-300/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                placeholder="Enter your username"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-blue-200 ml-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-blue-300/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:from-blue-600 hover:to-indigo-700 transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                    >
                        {loading ? (
                            <RefreshCw className="animate-spin" size={20} />
                        ) : (
                            <>
                                Sign In
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 flex items-center gap-4">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-blue-300/50 text-xs font-bold uppercase tracking-widest">Or continue with</span>
                    <div className="flex-1 h-px bg-white/10"></div>
                </div>

                <div className="mt-6 flex justify-center">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        theme="filled_blue"
                        shape="pill"
                        size="large"
                        width="100%"
                    />
                </div>

                <div className="mt-8 text-center">
                    <p className="text-blue-200 text-sm">
                        Don't have an account?{' '}
                        <Link to="/signup" className="text-white font-bold hover:underline underline-offset-4">
                            Create Profile
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
