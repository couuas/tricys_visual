import { userApi } from '../api/user';
import { authApi } from '../api/auth';
import { currentUser, isAuthenticated, setCurrentUser, clearAuth } from './authState';


export function useAuth() {

    // Initialize from LocalStorage
    const initAuth = async () => {
        const token = localStorage.getItem('tricys_auth_token');
        if (token) {
            try {
                // Verify token validity by fetching current user
                const user = await userApi.getCurrentUser();
                if (user) {
                    setCurrentUser(user);
                    return true;
                }
            } catch (e) {
                console.warn("Auth restoration failed", e);
                clearAuth();
            }
        }
        return false;
    };

    // Login (Real Auth)
    const login = async (username, password) => {
        try {
            // 1. Get Token
            const res = await authApi.login(username, password);
            if (res.access_token) {
                // 2. Save Token
                localStorage.setItem('tricys_auth_token', res.access_token);

                // 3. Fetch User Profile using /me endpoint
                const user = await userApi.getCurrentUser();

                setCurrentUser(user);

                return { success: true, user };
            } else {
                return { success: false, message: "No access token received" };
            }
        } catch (e) {
            console.error(e);
            return { success: false, message: "Invalid credentials" };
        }
    };

    // Register
    const register = async (userData) => {
        try {
            // Use authApi to register (includes password)
            const res = await authApi.register(userData);

            // Auto-login after register? Or just return success.
            // Backend auth/register returns {status: "success", msg: ...}
            // It does NOT return the user object or token.

            if (res.status === 'success') {
                // Determine user details (since backend doesn't return them, we assume success)
                // Optionally auto-login if password is available
                if (userData.username && userData.password) {
                    return await login(userData.username, userData.password);
                }
                return { success: true, user: { username: userData.username } };
            } else {
                return { success: false, message: "Unknown error" };
            }
        } catch (e) {
            let msg = "Registration failed";
            if (e.response && e.response.data && e.response.data.detail) {
                msg = e.response.data.detail;
            }
            return { success: false, message: msg };
        }
    };

    // Logout
    const logout = () => {
        clearAuth();
    };

    return {
        currentUser,
        isAuthenticated,
        initAuth,
        login,
        register,
        logout
    };
}
