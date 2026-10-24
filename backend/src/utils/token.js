const jwt = require('jsonwebtoken');

function setAuthCookie(res, user) {
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '60m' });
  res.cookie('ems_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    maxAge: 60 * 60 * 1000,
  });
}
function clearAuthCookie(res) { res.clearCookie('ems_token'); }

module.exports = { setAuthCookie, clearAuthCookie };
