import { Navigate, Outlet } from "react-router-dom";

export default function Redirect(
    isAllowed,
    redirectPath = '/auth',
    children) {
    if (!isAllowed) {
        return <Navigate to={redirectPath} replace />;
    }

    return children ? children : <Outlet />;
};