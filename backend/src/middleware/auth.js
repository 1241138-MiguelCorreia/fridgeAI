const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    // 1. Verificar token no header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Não autenticado. Faz login para continuar.',
      });
    }

    // 2. Verificar validade do token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido ou expirado. Faz login novamente.',
        code: 'TOKEN_EXPIRED',
      });
    }

    // 3. Verificar se o utilizador ainda existe
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilizador não encontrado.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro interno de autenticação.' });
  }
};

module.exports = { protect };
