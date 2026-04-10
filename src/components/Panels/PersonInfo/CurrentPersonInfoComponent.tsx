import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import styles from './CurrentPersonInfoComponent.module.scss'
import { useEffect, useState } from 'react';
import { loadCurrentAccountData } from '../../../redux/reducers/AccountsReducer';
import { loadCurrentPersonInfo } from '../../../redux/reducers/PersonInfo';
import EditPersonInfo from '../../EditPersonInfo/EditPersonInfo';
import Modal from 'react-modal';
import getAge from '../../../support/getAge';
import { ReduxState } from '../../../redux/store';
import { SimpleModal } from '../SimpleModal/SimpleModal';


export default function PersonInfoComponent() {
    const { currentAccount } = useSelector(({ accounts }: ReduxState) => accounts, shallowEqual);
    const { currentPersonInfo } = useSelector(({ persons }: ReduxState) => persons, shallowEqual);
    const [ modalIsOpen, setModalIsOpen ] = useState(false);

    useEffect(() => {
        if (!currentPersonInfo)
            loadCurrentPersonInfo();
    },[currentPersonInfo])

    return (
        <div className={styles.personal_data_wrapper}>
            <div className={styles.login_data_wrapper}>
                <img className={styles.main_avatar} src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQcbE6u36DvNqhRgUJtDR3MQDBcPkC3n83uXw&s" />
                {currentAccount ? currentAccount.login : "asdf"}
                
                    <span>Рейтинг</span>
            </div>

            <div className={styles.fio_wrapper}>
                <span>{currentPersonInfo?.lastName ?? "John"} {currentPersonInfo?.firstName ?? 'Doe'} {currentPersonInfo?.patronymic ?? ''}</span>
                <span>Возраст: {getAge(currentPersonInfo?.birthDate)}</span>
            </div>

            <div>
                <button onClick={() => setModalIsOpen(true)}>edit</button>
            </div>

            <SimpleModal isOpen={modalIsOpen} onClose={() => setModalIsOpen(false)} >
                <EditPersonInfo/>
            </SimpleModal>
        </div>
    );
}