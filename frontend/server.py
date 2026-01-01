# frontend/server.py
# import http.server
# import socketserver
# import os

# class SPAServer(http.server.SimpleHTTPRequestHandler):
#     def translate_path(self, path):
#         # Siempre devolver index.html para rutas que no son archivos
#         path = super().translate_path(path)
#         if not os.path.exists(path):
#             return os.path.join(os.getcwd(), "index.html")
#         return path

# if __name__ == "__main__":
#     PORT = 8081
#     with socketserver.TCPServer(("", PORT), SPAServer) as httpd:
#         print(f"Servidor SPA en http://localhost:{PORT}")
#         httpd.serve_forever()