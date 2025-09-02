# Agrar-Dashboard • MVP (Static + Docker)

Dies ist ein minimales **statisches Mockup** (HTML/CSS), verpackt in einen **Docker**-Container mit **nginx**.
Ideal für ein schnelles MVP, lokal und später auf AWS (S3/CloudFront **oder** ECS mit dem gleichen Image).

## Struktur
```
public/
  index.html
  styles-light.css
  styles.css        # (optional Dark Theme)
Dockerfile
nginx.conf
docker-compose.yml
.dockerignore
```

## Lokal starten (ohne Installation außer Docker)
```bash
# im Projektordner:
docker compose up --build
# -> Öffnen: http://localhost:8080
```

## Build eines Images (ohne compose)
```bash
docker build -t agra-dashboard-mvp:latest .
docker run --rm -p 8080:80 agra-dashboard-mvp:latest
```

## Deployment-Optionen

### 1) AWS S3 + CloudFront (empfohlen für **statische** Seiten)
- Inhalt von `public/` direkt in ein S3-Bucket hochladen.
- CloudFront davor schalten (OAC), Standardindex `index.html`.
- Vorteil: Kein Server, extrem günstig und skalierbar.

### 2) AWS ECS Fargate (Container)
- Dieses Image in **ECR** pushen.
- **ECS Service** (Fargate) + **ALB** erstellen, Port 80.
- Vorteil: Gleicher Container wie lokal; späterer API-Proxy möglich.

> Für beide Wege kann später CI/CD via GitHub Actions ergänzt werden.

## Hinweise
- Dieses Mockup enthält **keine** JavaScript-Funktionalität.
- Später kann ein API-Proxy ergänzt werden, ohne die HTML/CSS-Grundstruktur zu ändern.
