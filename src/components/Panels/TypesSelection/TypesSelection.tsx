import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import styles from './TypesSelection.module.scss';
import { ReduxState } from '../../../redux/store';
import { addSelectedEventType, dropSelectedEventType } from '../../../redux/reducers/EventsReducer';
import { useState } from 'react';

export default function TypesSelection() {
    const dispatch = useDispatch();
    const { eventCategories } = useSelector(({ events }: ReduxState) => events, shallowEqual);
    const { eventTypes } = useSelector(({ events }: ReduxState) => events, shallowEqual);
    const { selectedEventTypes } = useSelector(({ events }: ReduxState) => events, shallowEqual);
    const [displatedEventTypes, setDisplatedEventTypes] = useState(eventTypes);
    
    function setEventTypeToSelected(eventTypeId) {
        var curEventType = eventTypes?.find(i => i.id === eventTypeId)
        if (curEventType) {
            var index = selectedEventTypes?.indexOf(curEventType);
            if (index) {
                if (index > -1)
                    dispatch(dropSelectedEventType(curEventType));
                else
                    dispatch(addSelectedEventType(curEventType));
            }
            else{
                dispatch(addSelectedEventType(curEventType));
            }
        }
    }

    function setEventCategoryChecked(eventCategoryId, checked){        
        if (checked){
            let curCategoryEventTypes = eventTypes.find(i => i.eventCategoryId === eventCategoryId)
        }
        else
        {

        }
    }

    function eventTypeIsSelected(eventTypeId) {
        let curEventType = selectedEventTypes?.find(i => i.id === eventTypeId)
        if (curEventType)
            return true;
        return false;
    }

    let categoryItems = eventCategories ? eventCategories.map(c => 
        <div> 
            <label htmlFor={c.id}>{c.name}</label>
            <input type="checkbox" onChange={(e) => setEventCategoryChecked(c.id, e.currentTarget.value)} defaultChecked={true} id={c.id} />
        </div>) : null;

    let typeItems = displatedEventTypes ? displatedEventTypes.map(t =>
        <div>
            <label htmlFor={t.id}>{t.name}</label>
            <input type="checkbox" onChange={() => setEventTypeToSelected(t.id)} defaultChecked={eventTypeIsSelected(t.id)} id={t.id} />
        </div>) : null;

    return (
        <div className={styles.types_selector_wrapper}>
            <div className={styles.categories_wrapper}>
                <h3>Categories</h3>
                {categoryItems}
            </div>
            <div className={styles.types_wrapper}>
                <h3>Types</h3>
                {typeItems}
            </div>
        </div>
    );
}