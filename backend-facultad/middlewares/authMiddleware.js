const jwt = require('jsonwebtoken');

// Verifica que el usuario haya enviado un token válido
const verificarToken = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ error: 'Acceso denegado. No hay token proporcionado.' });
  }

  // El formato estándar es "Bearer <token>"
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Formato de token inválido.' });
  }

  try {
    const verificado = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = verificado; // Guardamos el id y rol del usuario en la petición
    next(); // Permite que la petición continúe hacia la ruta
  } catch (error) {
    res.status(400).json({ error: 'Token no válido o ha expirado.' });
  }
};

// Verifica si el usuario tiene el rol adecuado para la acción
const verificarRol = (rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Acceso denegado. No tienes permisos para esta acción.' });
    }
    next();
  };
};

module.exports = { verificarToken, verificarRol };