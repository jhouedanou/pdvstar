# 🔄 Pour réinitialiser les événements avec toutes les coordonnées

Si vous ne voyez que 3 événements sur la carte, exécutez ceci dans la console du navigateur (F12) :

```javascript
// Option 1: Supprimer uniquement les événements
localStorage.removeItem('pdvstar_db_events')
location.reload()

// Option 2: Tout réinitialiser (utilisateurs + événements)
localStorage.clear()
location.reload()
```

Ou utilisez ces raccourcis :
- **Chrome/Edge**: F12 → Console → Copier/Coller le code
- **Safari**: Cmd+Option+C → Console → Copier/Coller le code
- **Firefox**: F12 → Console → Copier/Coller le code

Après le reload, tous les 20 événements devraient apparaître sur la carte ! 📍
