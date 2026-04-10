import { useState } from "react";
import { useDispatch } from "react-redux";

function ToggleSwitch() {
    const dispatch = useDispatch();
    const [isOn, setIsOn] = useState(false);
    const [darkMode, setDarkMode] = useState<boolean>(false);
    
    const handleToggle = () => {
        setIsOn(!isOn);
    };


    

  return (
    <div>

    </div>

  );
}

export default ToggleSwitch;