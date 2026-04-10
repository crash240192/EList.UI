import './SimpleModal.css';
import {Transition} from "react-transition-group";

export function SimpleModal({ isOpen, onClose, children }) {

    function onWrapperClick(event){
        if (event.target.classList.contains('modal-wrapper')) onClose();
    }

    return (
        
             <Transition in={isOpen} timeout={250} unmountOnExit={true}>
                {(state) => (
                    <div className={`modal modal--${state}`}>
                        <div className='modal-wrapper' onClick={onWrapperClick}>
                            <div className='modal-content'>
                                <button className='modal-close-button' onClick={() => onClose()}>
                                    X
                                </button>
                                {children}
                            </div>
                        </div>
                    </div>
                )}
            </Transition> 
        
    );
}