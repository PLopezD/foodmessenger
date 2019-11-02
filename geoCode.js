'use strict';
const opencage = require('opencage-api-client');
const geolib = require('geolib');

function geoDecode(x) {
    console.log("Inside geoDecode" , x)
    let cArr = "";
    return opencage.geocode({q:x}).then(data => {
        //console.log(JSON.stringify(data))
        if (data.status.code == 200) {
        if (data.results.length > 0) {
            var place = data.results[0];
            cArr = {"lat": place.geometry.lat, "lng": place.geometry.lng};
            return cArr;
        }
        } else if (data.status.code == 402) {
            console.log('hit free-trial daily limit');
            console.log('become a customer: https://opencagedata.com/pricing');
        } else {
            console.log('error', data.status.message);
        }
    }).catch(error => {
        console.log('error', error.message);
    });
}

function getLocation(locationOne, locationTwo) {
    cArray = [];
    cArray.push(geoDecode(locationOne), geoDecode(locationTwo))
    Promise.all(cArray).then(res => {
        console.log("Response is : ",res);
        let distance=geolib.getDistance(
            { latitude: res[0].lat, longitude: res[0].lng },
            { latitude: res[1].lat, longitude: res[1].lng }
        );
        console.log(locationOne, " is ", distance, " mts away from ", locationTwo);
        return distance
    })
}

return getLocation