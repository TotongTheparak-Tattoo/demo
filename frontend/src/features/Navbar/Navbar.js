import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PreviewIcon from '@mui/icons-material/Preview';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReportIcon from '@mui/icons-material/Report';
import Summery from '@mui/icons-material/Summarize';
function Navbar() {
  const [value, setValue] = useState(0);
  const navigate = useNavigate();

  const handleChange = (event, newValue) => {
    setValue(newValue);

    switch (newValue) {
      case 0:
        navigate('/UploadExcel');
        break;
      case 1:
        navigate('/PlanResult');
        break;
      case 2:
        navigate('/PreviewPlanPage');
        break;
      case 3:
        navigate('/Dashboard');
        break;
      case 4:
        navigate('/Report');
        break;
      case 5:
        navigate('/Summery');
        break;      
      default:
        break;
    }
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        margin: 0,
        borderRadius: 0,
        zIndex: 1300
      }}
      elevation={3}
    >
      <BottomNavigation value={value} onChange={handleChange} showLabels>
        <BottomNavigationAction label="Upload" icon={<UploadFileIcon />} />
        <BottomNavigationAction label="PlanResult" icon={<AssignmentIcon />} />
        <BottomNavigationAction label="PreviewPlan" icon={<PreviewIcon />} />
        <BottomNavigationAction label="Dashboard" icon={<DashboardIcon />} />
        <BottomNavigationAction label="Report" icon={<ReportIcon />} />
        <BottomNavigationAction label="Summery" icon={<Summery />} /> 
      </BottomNavigation>
    </Paper>
  );
}

export default Navbar;
