# Tiny static site image for Railway.
# Uses Caddy because it's one binary, ~40MB, and serves static files with zero config.
FROM caddy:2-alpine

# Railway injects $PORT at runtime; Caddyfile reads it.
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html /srv/index.html

EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
