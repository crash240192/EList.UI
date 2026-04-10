import { useEffect, useState } from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { NavLink, useNavigate } from "react-router-dom";
import { routes } from "../../Routes";
import { ReduxState } from "../../redux/store";
import { ContactType } from "../../api/models/Contacts/ContactType";
import { requestsRepository } from "../../api/RequestsRepository";
import styles from "./RegistrationPage.module.scss";

export default function RegistrationPage() {
    //const [params] = useSearchParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [location, setLocation] = useState({ x: 0, y: 0 });
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [contactValue, setContactValue] = useState('');
    const [contactType, setContactType] = useState<ContactType>(null);
    const [showContact, setShowContact] = useState(true);    
    const { contactTypes } = useSelector(({ contacts }: ReduxState) => contacts, shallowEqual);
    const [contactTypeItems, setContactTypeItems] = useState(null);

    useEffect(() => {
        if (contactTypes) {
            let contactTypeItems = contactTypes != null ? contactTypes.map(type => <option className={styles.drop_box_options} value={type.id}>{type.localizedName}</option>) : null
            setContactTypeItems(contactTypeItems);
            setContactType(contactTypes[0]);
        }
    }, [contactTypes]);

    function setCurrentContactType(id: string) {
        let curType = contactTypes?.find(i => i.id === id) ?? null;
        setContactType(curType);
    }

    function register() {
        requestsRepository.AccountApiService.createAccount({
            locationX: location.x,
            locationY: location.y,
            login,
            password,
            passwordConfirmation,
            authorizationContactValue: contactValue,
            authorizationContactType: contactType.id,
            showContact
        })
            .then(response => {
                if (response.message)
                    alert(response.message);
                if (response.success){
                    alert("Регистрация прошла успешно");
                    navigate(routes.auth);
                }
            })
            
    }

    return (
        <div className={styles.registration_wrapper}>
            <div className={styles.coordinates_wrapper}>
                <h2>тут будет выбор координат</h2>
            </div>
            <div className={styles.account_wrapper}>
                <label htmlFor="login">Логин:</label>
                <input id="login" onChange={e => setLogin(e.currentTarget.value)}/>
                <label htmlFor="password">Пароль:</label>
                <input id="password" type="password" onChange={e => setPassword(e.currentTarget.value)} />
                <label htmlFor="retype_password">Повторите пароль:</label>
                <input id="retype_password" type="password" onChange={e => setPasswordConfirmation(e.currentTarget.value)} />
            </div>
            <div className={styles.contacts_wrapper}>
                <label htmlFor="contact-type">Тип контакта:</label>
                <select id="contact-type" onChange={e => setCurrentContactType(e.currentTarget.value)} multiple={false} size={1}>
                    {contactTypeItems}
                </select>
                <label htmlFor="contact-value">Контакт:</label>
                <input id="contact-value" onChange={e => setContactValue(e.currentTarget.value)}/>
                <label htmlFor="show-contact">Отображать контакт:</label>
                <input id='show-contact' className={styles.checkbox} type="checkbox" defaultChecked={true} onChange={e => setShowContact(e.currentTarget.checked)} />
            </div>
            <div className={styles.buttons_wrapper}>
                <button onClick={() => register()}>Зарегистрироваться</button>
                <button onClick={() => navigate(routes.auth)} >Назад</button>
            </div>
        </div>
    );
}