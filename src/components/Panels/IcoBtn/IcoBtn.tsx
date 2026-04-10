import styles from './IcoBtn.module.scss';

export default function IcoBtn({ text, ico }) {
    const renderIcon = () => {
        if (typeof ico === 'string') {
            return <img src={ico} alt="" className="icon-button__icon" />;
        }
        return <span className="icon-button__icon">{ico}</span>;
    };


    return (
        <button
            className='ico_btn'
            // onClick={onclick}
        >
            {renderIcon()}
            <span className="icon-button__text">{text}</span>
        </button>
    );
}