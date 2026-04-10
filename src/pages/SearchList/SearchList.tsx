import { NavLink } from 'react-router-dom';
import styles from './SearchList.module.scss'
import { routes } from '../../Routes';
import TypesSelection from '../../components/Panels/TypesSelection/TypesSelection';
import { useEffect, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { ReduxState } from '../../redux/store';
import { loadAllEventCategories, loadAllEventTypes, loadGlobalEvents } from '../../redux/reducers/EventsReducer';
import { EventsSearchRequest } from '../../api/models/Events/EventsSearchRequest';

export default function SearchList() {
    // const dispatch = useDispatch();
    // const [ typesWindow, setTypesWindowIsOpen ] = useState(false);
    

    return (
        <div className={styles.search_list}>
            Список
            {/* <div className={styles.events_navigation}>
                <NavLink to={routes.actualEvents}>Актуальные</NavLink>
                <NavLink to={routes.events}>Глобальный поиск</NavLink>
                <NavLink to={routes.archivedEvents}>Завершённые</NavLink>
            </div> */}

            

            {/* <SimpleModal isOpen={typesWindow} onClose={() => setTypesWindowIsOpen(false)} >
                <TypesSelection/>
            </SimpleModal> */}
        </div>
    );
}