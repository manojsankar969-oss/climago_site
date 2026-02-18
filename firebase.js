// Firebase Module — handles init, auth, and analytics
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import { getAnalytics, logEvent } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js';
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';

let app = null;
let analytics = null;
let auth = null;
const provider = new GoogleAuthProvider();

// Initialize Firebase
export async function initFirebase() {
    try {
        const res = await fetch('/api/firebase-config');
        const config = await res.json();

        if (!config.apiKey) {
            console.warn('Firebase config missing, auth disabled.');
            return false;
        }

        app = initializeApp(config);
        analytics = getAnalytics(app);
        auth = getAuth(app);

        console.log('Firebase initialized');
        return true;
    } catch (e) {
        console.error('Firebase init failed:', e);
        return false;
    }
}

// Google Sign-In
export async function signInWithGoogle() {
    if (!auth) return null;
    try {
        const result = await signInWithPopup(auth, provider);
        logEvent(analytics, 'login', { method: 'google' });
        return result.user;
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user') {
            console.log('Sign-in popup closed by user');
            return null;
        }
        console.error('Sign-in error:', error);
        throw error;
    }
}

// Sign Out
export async function signOutUser() {
    if (!auth) return;
    try {
        await firebaseSignOut(auth);
        logEvent(analytics, 'logout');
    } catch (error) {
        console.error('Sign-out error:', error);
    }
}

// Auth State Observer
export function onAuthChanged(callback) {
    if (!auth) return;
    onAuthStateChanged(auth, callback);
}

// Analytics Helpers
export function trackEvent(eventName, params = {}) {
    if (!analytics) return;
    logEvent(analytics, eventName, params);
}

export function trackSearch(city) {
    trackEvent('search', { city });
}

export function trackCompare(cityA, cityB) {
    trackEvent('compare_cities', { city_a: cityA, city_b: cityB });
}
