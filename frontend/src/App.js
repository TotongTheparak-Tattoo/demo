// App.js ✅
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './features/Navbar/Navbar';
import UploadExcel from './features/Upload/UploadExcel';
import PlanResult from './features/PlanResult/PlanResult';
import PreviewPlanPage from './features/PlanPreview/PlanPreview';
import Dashboard from './features/Dashboard/Dashboard';
import Report from './features/Report/Report';
import Login from './features/account/Login';
import Register from './features/account/Register';
import Summery from './features/summery/Summery';

function App() {
  const location = useLocation();
  const hideNavbarPaths = ['/Login','/Register'];

  return (
    <>
      {!hideNavbarPaths.includes(location.pathname) && <Navbar />}
      <Routes>
        <Route path="/" element={<UploadExcel />} />
        {/* <Route path="/Register" element={<Login />} /> */}
        <Route path="/UploadExcel" element={<UploadExcel />} />
        <Route path="/PlanResult" element={<PlanResult />} />
        <Route path="/PreviewPlanPage" element={<PreviewPlanPage />} />
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/Report" element={<Report />} />
        <Route path="/Summery" element={<Summery />} />
      </Routes>
    </>
  );
}

export default App;
