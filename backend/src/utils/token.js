const jwt = require('jsonwebtoken');

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV !== 'development',
    maxAge: 60 * 60 * 1000,
    path: '/',
  };
}

function setAuthCookie(res, user) {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '60m' }
  );

  res.cookie('ems_token', token, cookieOptions());
}

function clearAuthCookie(res) {
  const options = cookieOptions();
  delete options.maxAge;
  res.clearCookie('ems_token', options);
}

module.exports = { setAuthCookie, clearAuthCookie };
