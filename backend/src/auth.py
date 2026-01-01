# src/auth.py
import streamlit as st
import requests
from jose import jwt
import time

class KeycloakAuth:
    def __init__(self):
        self.server_url = "http://localhost:8080"
        self.realm = "hermes"
        self.client_id = "hermes-app"
        self.client_secret = "tI1BIbPA6iH5dIvmqxDNtFPxY3Ljq36X"  # ← ¡Asegúrate de que este es el correcto!
        self.redirect_uri = "http://localhost:8501/"
        self.token_key = "keycloak_access_token"
        
    def get_auth_url(self):
        """Genera la URL de autenticación de Keycloak."""
        return (
            f"{self.server_url}/realms/{self.realm}/protocol/openid-connect/auth"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&response_type=code"
            f"&scope=openid profile email roles"
        )
    
    def exchange_code_for_token(self, code):
        """Intercambia el código de autorización por tokens."""
        token_url = f"{self.server_url}/realms/{self.realm}/protocol/openid-connect/token"
        
        data = {
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": self.redirect_uri
        }
        
        response = requests.post(token_url, data=data)
        if response.status_code == 200:
            return response.json()
        else:
            st.error(f"Error al obtener token: {response.text}")
            return None
    
    def decode_token(self, token):
        """Decodifica el token JWT para obtener la información del usuario."""
        jwks_url = f"{self.server_url}/realms/{self.realm}/protocol/openid-connect/certs"
        jwks = requests.get(jwks_url).json()
        
        header = jwt.get_unverified_header(token)
        kid = header['kid']
        
        public_key = None
        for key in jwks['keys']:
            if key['kid'] == kid:
                from jose import jwk
                public_key = jwk.construct(key)
                break
        
        if public_key:
            return jwt.decode(token, public_key, algorithms=['RS256'], options={"verify_aud": False})
        else:
            return jwt.get_unverified_claims(token)
    
    def login(self):
        """Maneja el flujo de login completo."""
        try:
            # Verificar si ya tenemos tokens guardados en session_state
            if self.token_key in st.session_state and st.session_state[self.token_key]:
                try:
                    user_info = self.decode_token(st.session_state[self.token_key])
                    return self._process_user_info(user_info)
                except Exception as e:
                    st.warning("Sesión expirada, por favor inicia sesión de nuevo.")
                    if self.token_key in st.session_state:
                        del st.session_state[self.token_key]
            
            # Verificar si tenemos un código de autorización
            query_params = st.query_params
            if "code" in query_params:
                code = query_params["code"]
                st.query_params.clear()
                
                tokens = self.exchange_code_for_token(code)
                if tokens:
                    # Guardar token directamente en session_state (más confiable)
                    st.session_state[self.token_key] = tokens['access_token']
                    user_info = self.decode_token(tokens['access_token'])
                    return self._process_user_info(user_info)
                else:
                    st.error("❌ Error de autenticación. Por favor, intenta iniciar sesión de nuevo.")
                    return {"authenticated": False}
            
            return {"authenticated": False}
            
        except Exception as e:
            st.error(f"Error en autenticación: {str(e)}")
            return {"authenticated": False}
    
    def _process_user_info(self, user_info):
        """Procesa la información del usuario y extrae el departamento."""
        user_roles = user_info.get("realm_access", {}).get("roles", [])
        department = "IT"
        valid_departments = ["[1014] Sistemas", "IT", "Finanzas", "RRHH", "Marketing", "Dirección"]
        
        for role in user_roles:
            if role in valid_departments:
                department = role
                break
        
        return {
            "authenticated": True,
            "username": user_info.get("preferred_username", user_info.get("sub", "usuario")),
            "email": user_info.get("email", ""),
            "department": department,
            "roles": user_roles
        }
    
    def logout(self):
        """Cierra la sesión del usuario."""
        if self.token_key in st.session_state:
            del st.session_state[self.token_key]
        st.query_params.clear()

# Función de conveniencia
def authenticate():
    auth = KeycloakAuth()
    return auth.login()

def logout():
    auth = KeycloakAuth()
    auth.logout()