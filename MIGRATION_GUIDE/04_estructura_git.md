# 04 - Estructura Git + Ramas + CI/CD

## Repositorios

### Opción recomendada: Monorepo
Un solo repo `your-erp-firebase` con todo:

```
your-erp-firebase/
├── .github/workflows/     ← CI/CD
├── functions/             ← Backend
├── web/                   ← Frontend
├── firebase.json
└── README.md
```

### Ramas Git

```
main        ← Producción real (deploy automático a Firebase Prod)
  ↑
staging     ← Pruebas internas (deploy automático a Firebase Staging)
  ↑
develop     ← Integración diaria (deploy automático a Firebase Dev)
  ↑
feature/*   ← Features individuales (PR a develop)
```

### GitHub Actions (CI/CD)

Crear archivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [main, staging, develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          
      - name: Install Dependencies (Web)
        run: cd web && npm ci
        
      - name: Build Web
        run: cd web && npm run build
        
      - name: Install Dependencies (Functions)
        run: cd functions && npm ci
        
      - name: Build Functions
        run: cd functions && npm run build
        
      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy --only hosting,functions,firestore
        env:
          GCP_SA_KEY: ${{ secrets.GCP_SA_KEY }}
```

### Proyectos Firebase

| Rama | Proyecto Firebase | URL |
|------|-------------------|-----|
| `main` | `your-erp-prod` | https://app.yourerp.com |
| `staging` | `your-erp-staging` | https://staging.yourerp.com |
| `develop` | `your-erp-dev` | https://dev.yourerp.com |

Configurar en `.firebaserc`:
```json
{
  "projects": {
    "default": "your-erp-dev",
    "staging": "your-erp-staging",
    "prod": "your-erp-prod"
  }
}
```

### Variables de entorno por ambiente

```bash
# Development (emuladores)
VITE_FIREBASE_PROJECT_ID=your-erp-dev

# Staging
VITE_FIREBASE_PROJECT_ID=your-erp-staging

# Production
VITE_FIREBASE_PROJECT_ID=your-erp-prod
```
