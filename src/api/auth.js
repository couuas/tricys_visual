import apiClient from './client';

export const authApi = {
    // Login (OAuth2 Password Grant)
    login(username, password) {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        return apiClient.post('/auth/login', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    },

    // Register (JSON)
    register(userData) {
        // userData: { username, password, full_name, email }
        // Backend expects Query params for simple register? No, let's check auth.py.
        // auth.py: register_user(username: str, password: str, ...)
        // Wait, auth.py uses arguments, not a Pydantic model. 
        // In FastAPI, if not Body(...), they might be Query params.
        // Let's re-verify auth.py signature.
        // It says: def register_user(username: str, password: str, ...)
        // Yes, these are Query params by default in FastAPI unless Body or Form is used.
        // This seems like a backend design quirk. 
        // Let's check if they intended JSON. Usually one uses a Pydantic model.
        // The previous analysis of `auth.py` showed distinct arguments.
        // I will try sending as Query params first, or JSON if apiClient handles it.
        // If they are query params, I should pass them in `params`.
        // Backend now expects JSON Body (UserRegister model)
        return apiClient.post('/auth/register', userData);
    }
};
