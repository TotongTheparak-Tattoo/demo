import React, { useState } from 'react';
import { TextField, Button, Typography, Box, Alert, IconButton } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
const API_URL = process.env.REACT_APP_API_URL;

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [emp_no, setEmp_no] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessageType('error');
      setMessage('❌ Password และ Confirm Password ไม่ตรงกัน');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({emp_no, username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessageType('success');
        setMessage('✅ ลงทะเบียนสำเร็จ! กำลังพาไปหน้า Login...');
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        setMessageType('error');
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      setMessageType('error');
      setMessage('❌ Server error');
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
      position="relative"
    >
      <IconButton
        onClick={() => navigate('/')}
        sx={{ position: 'absolute', top: 8, left: 8 }}
        color="primary"
      >
        <ArrowBackIcon />
      </IconButton>

      <Typography variant="h4" component="h2" gutterBottom align="center">
        Register
      </Typography>

      <form onSubmit={handleSubmit} noValidate>
        <TextField
          fullWidth
          label="Emp.No"
          variant="outlined"
          margin="normal"
          value={emp_no}
          onChange={(e) => setEmp_no(e.target.value)}
          required
        />

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

        <TextField
          fullWidth
          label="Confirm Password"
          type="password"
          variant="outlined"
          margin="normal"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          sx={{ mt: 2 }}
        >
          Register
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

export default Register;
