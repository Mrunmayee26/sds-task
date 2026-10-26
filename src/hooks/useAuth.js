import { useContext } from 'react';
import { AuthContext } from '../services/authContext';
export const useAuth = () => useContext(AuthContext);
