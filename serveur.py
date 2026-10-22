#!/usr/bin/env python3
"""Petit serveur local pour lancer l'application : python3 serveur.py (ou python serveur.py sous Windows).

Force les bons types de fichiers (certains Windows déclarent .js comme texte, ce qui bloque l'application),
puis ouvre le navigateur sur http://localhost:8080. Arrêt : Ctrl+C.
"""
import http.server
import os
import socketserver
import sys
import webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
        '.png': 'image/png',
        '.html': 'text/html',
    }

    def end_headers(self):
        # Pas de cache navigateur pendant les essais : le service worker gère le hors-connexion.
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


with Server(('', PORT), Handler) as httpd:
    url = f'http://localhost:{PORT}'
    print(f'Application disponible sur {url}  (Ctrl+C pour arrêter)')
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServeur arrêté. Vos données restent enregistrées dans le navigateur.')
