export default function getAge(dateString) {
    if (!dateString)
        return null;

    let today = new Date();
    let birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();

    let m = today.getMonth() - birthDate.getMonth();
    let d = today.getDay() - birthDate.getDay();

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    // if ( age === 0 ) {
    //     m = 12 + m;
    //     if (d < 0 || (d === 0 && today.getDate() < birthDate.getDate())) {
    //         m--;
    //     }
    // }
    return age;
    // return age ? age + 'г' : m + 'м';
}