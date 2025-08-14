// src/page/Login.js
import React, { useState, useEffect } from 'react';
import { TextField, Button, Typography, Box, Alert } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { useNavigate } from 'react-router-dom';
const API_URL = process.env.REACT_APP_API_URL;

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem('username');
    if (user) {
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok) {
        setMessageType('success');
        setMessage(`✅ Welcome ${data.username}`);

        localStorage.setItem('username', data.username);
        localStorage.setItem('password', data.password);

        setTimeout(() => {
          navigate('/');
        }, 1000);
      } else {
        setMessageType('error');
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setMessageType('error');
      setMessage('❌ Server error');
      console.error(err);
    }
  };

  return (
    <Box
      maxWidth={400}
      mx="auto"
      mt={10}
      p={3}
      boxShadow={3}
      borderRadius={2}
      bgcolor="background.paper"
    >
      <Typography variant="h4" component="h2" gutterBottom align="center">
        Login
      </Typography>

      <form onSubmit={handleSubmit} noValidate>
        <TextField
          fullWidth
          label="Username"
          variant="outlined"
          margin="normal"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <TextField
          fullWidth
          label="Password"
          type="password"
          variant="outlined"
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          sx={{ mt: 2 }}
        >
          Login
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="secondary"
          fullWidth
          sx={{ mt: 2 }}
          onClick={() => navigate('/register')}
        >
          REGISTER
        </Button>
      </form>

      {message && (
        <Alert icon={<CheckIcon fontSize="inherit" />} severity={messageType} sx={{ mt: 3 }}>
          {message}
        </Alert>
      )}
    </Box>
  );
}

export default Login;
