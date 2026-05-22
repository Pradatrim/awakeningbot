import { Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import AdLanding from './pages/AdLanding';
import Provider from './pages/Provider';
import Specialist from './pages/Specialist';
import Join from './pages/Join';
import Home from './pages/Home';
import CheckIn from './pages/CheckIn';
import Vitals from './pages/Vitals';
import ClinicianLogin from './pages/ClinicianLogin';
import ClinicianPanel from './pages/ClinicianPanel';
import ClinicianPatient from './pages/ClinicianPatient';

export default function App() {
  return (
    <div className="phone">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/care" element={<AdLanding />} />
        <Route path="/provider" element={<Provider />} />
        <Route path="/specialist" element={<Specialist />} />
        <Route path="/join/:token" element={<Join />} />
        <Route path="/home" element={<Home />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/vitals" element={<Vitals />} />
        <Route path="/clinician/login" element={<ClinicianLogin />} />
        <Route path="/clinician" element={<ClinicianPanel />} />
        <Route path="/clinician/patient/:id" element={<ClinicianPatient />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </div>
  );
}
