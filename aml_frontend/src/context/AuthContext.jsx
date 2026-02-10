import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('access_token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            // Optionally verify token or fetch user profile
            const savedUser = localStorage.getItem('user');
            if (savedUser) setUser(JSON.parse(savedUser));
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        setLoading(false);
    }, [token]);

    const login = async (username, password) => {
        const response = await axios.post('http://localhost:8000/api/login/', { username, password });
        const { access, refresh } = response.data;
        setToken(access);
        const userData = { username };
        setUser(userData);
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        localStorage.setItem('user', JSON.stringify(userData));
        axios.defaults.headers.common['Authorization'] = `Bearer ${access}`;
        return response.data;
    };

    const signup = async (username, password, email) => {
        const response = await axios.post('http://localhost:8000/api/signup/', { username, password, email });
        const { tokens, user: userData } = response.data;
        setToken(tokens.access);
        setUser(userData);
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
        localStorage.setItem('user', JSON.stringify(userData));
        axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.access}`;
        return response.data;
    };

    const googleLogin = async (token) => {
        const response = await axios.post('http://localhost:8000/api/google-login/', { token });
        const { tokens, user: userData } = response.data;
        setToken(tokens.access);
        setUser(userData);
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
        localStorage.setItem('user', JSON.stringify(userData));
        axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.access}`;
        return response.data;
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
    };

    return (
        <AuthContext.Provider value={{ user, token, login, signup, googleLogin, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
