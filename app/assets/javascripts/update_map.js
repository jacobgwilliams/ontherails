//SCOTTS BUTTON
$('document').ready(function() {
  $('form').submit(function(event) {
    event.preventDefault();
    var $form = $(this);
    var url = $form.attr('action');
    $.ajax({
      url: url,
      method: 'get'
    }).done(function(responseJSON){
      updateTrainPosition(responseJSON);
      var mtaTimestamp = responseJSON.time_updated;
      updateTimestamp(mtaTimestamp);
    });
  });
});

function handleClick(line) {
  line.classList.toggle('checked');
  var trainLinesToHide = trainLineChecker();
  updateStations(trainLinesToHide);
  updateRoutes(trainLinesToHide);
  updateTrainsForLine(trainLinesToHide, line.value)
}

function updateStations(options) {
  stations.forEach(function(marker){
    if (intersection(options, marker.trainLines.split('').sort()).length)
    {
      marker.setVisible(true);
    }
    else {
      marker.setVisible(false);
    }
  })
}

function intersection(a, b) {
  var ai=0, bi=0;
  var result = [];
  while( ai < a.length && bi < b.length )
  {
     if      (a[ai] < b[bi] ){ ai++; }
     else if (a[ai] > b[bi] ){ bi++; }
     else /* they're equal */
     {
       result.push(a[ai]);
       ai++;
       bi++;
     }
  }
  return result;
}

function updateRoutes(options)
{
  curvePaths.forEach(function(line){
    if (options.indexOf(line.title[0]) === -1)
    {
      line.setVisible(false);
    }
    else{
      line.setVisible(true);
    }
  })
}

function updateTrainsForLine(lineID_array, lineToHide) {
  trains.forEach(function(marker) {
    if(lineID_array.indexOf(marker.label[0]) === -1) {
      marker.setVisible(false);
    }
    else {
      marker.setVisible(true);
    }
  });
}

function trainLineChecker() {
  var checkedLines = [];
  var $linesToCheck = $('.checked')
  $linesToCheck.each(function(i){
    checkedLines[i] = $linesToCheck[i].value;
  });
  return checkedLines;
}

function updateTimestamp(unixTimestamp) {
  var readableTimestamp = timeConverter(unixTimestamp)
  var currentTime = Math.floor((new Date()).getTime() / 1000)
  if((currentTime - unixTimestamp) > 60) {
    $('p#mta-timestamp').text('Advisory: Train locations may not be accurate. MTA data was last updated at: ' + readableTimestamp);
  }
  else {
    $('span#update_time').text(readableTimestamp);
  }
}

function clearTrainLocations(trainsArray) {
  trainsArray.forEach(function(train) {
    train.setMap(null);
  });
}

function hideMarker(marker) {
  marker.setVisible(false);
}

function showMarker(marker) {
  marker.setVisible(true);
}

function showOrHideMarkers(markersToHide, marker) {
  if(markersToHide.indexOf(marker.label[0]) === -1 ) {
    hideMarker(marker)
  }
  else {
    showMarker(marker)
  }
}

function updateTrainPosition(responseJSON){
  clearTrainLocations(trains);
  trains = [];
  var trainLinesToHide = trainLineChecker();

  var keys1 = Object.keys(responseJSON).slice(0,-1);
  var timestamp = responseJSON.time_updated;
  keys1.forEach(function(key){
    var train = responseJSON[key]
    // take the x from 6x
    var fullrouteID = train.route_id
    var routeId = train.route_id[0];
    var stopTimes = train.stop_time;
    if (stopTimes[0].arrival && stopTimes[0].departure){
      //Assume in this case, they are in the station at stopTimes[0]
      if (stopTimes[0].departure != stopTimes[0].arrival){

        var stopId = stopTimes[0].stop_id.substr(0,3);
        var direction =stopTimes[0].stop_id.substr(3);

        var currentStation = stations.filter(function(station){
          return (station.label === stopId)
        })
        var trainMarker = new google.maps.Marker({
          position: {lat:currentStation[0].getPosition().lat(), lng:currentStation[0].getPosition().lng()},
          icon: stopIcon(routeId),
          map: map,
          label: routeId + direction
        });

        showOrHideMarkers(trainLinesToHide, trainMarker);

      } else {
        //HERE WE ASSUME TRAIN IS MOVING
        var stopId = stopTimes[0].stop_id.substr(0,3);
        var direction =stopTimes[0].stop_id.substr(3);
        var nextStation = stations.filter(function(station){
          return (station.label === stopId)
        })

        $.ajax({
          url: '/find_previous_station',
          method: 'post',
          data: {
            'station': stopId,
            'line': routeId,
            'time': timestamp,
            'direction': direction,
            'fullrouteID': fullrouteID,
            'arrivalTime': stopTimes[0].arrival
          }
        }).done(function(response) {
          var prevStation = stations.filter(function(station){
            return (station.label === response.prev_station)
          })
          //NEW CURVE FOLLOWING CODE

          //Select the curve which matches the current path which the train is on. For example if our train is the 5X train we are looking for the curve that corresponds with this train.

          //This means we need to make sure we have a curve for every train possibility. Which I am not sure if we do. Here we have the current curve, and previous station and next station variable so we can find the chunk of track which we are supposed to be on. We need to use the current timestamp and the expected arrival time to estimate where we are on the array of points. If ~250 points is 3 minutes then every point is 1.4 seconds. This means if we are 60 seconds away we are 60/1.4 points away. And we move 1.4 points every second.\
          if (response.prev_station){
            var localCurveCoordinates = JSON.parse(JSON.stringify(curveCoordinatesArray));
            var currentCurve = localCurveCoordinates.filter(function(curve){
              return (curve.curveId == response.fullrouteID);
            })
            // var currentCurvePath = curvePaths.filter(function(curve){
            //   return curve.title === fullrouteID;
            // })
            prevStationCoords = getCoordinatesOfStation(prevStation);
            nxtStationCoords = getCoordinatesOfStation(nextStation);
            var tempCoords = currentCurve[0].coordinates
            var tempCoords1 = currentCurve[0].coordinates

            var prevIndexOnCurve='';
            var nxtIndexOnCurve='';
            for (var i =0; i < tempCoords.length;i++)
            {
              if ((prevStationCoords.lat.toFixed(5) == tempCoords[i].lat.toFixed(5)) && (prevStationCoords.lng.toFixed(5) == tempCoords[i].lng.toFixed(5))){
                prevIndexOnCurve = i;
              }
              if ((nxtStationCoords.lat.toFixed(5) == tempCoords[i].lat.toFixed(5)) && (nxtStationCoords.lng.toFixed(5) == tempCoords[i].lng.toFixed(5))){
                nxtIndexOnCurve = i;
              }
            }
            // variables prevIndexOnCurve  nxtIndexOnCurve, tempCoords is an array of the coordinates for the index
            var newPath = '';
            var segmentLine = ''
            if (response.direction == "N"){
              newPath = tempCoords1.splice(prevIndexOnCurve,(nxtIndexOnCurve-prevIndexOnCurve)+1)
              segmentLine = new google.maps.Polyline({
                path: newPath
              });
            }
            else {
              newPath = tempCoords1.splice(nxtIndexOnCurve,(prevIndexOnCurve-nxtIndexOnCurve)+1)
              segmentLine = new google.maps.Polyline({
                path: newPath
              });
            }
            //AT THIS POINT WE HAVE A TIME WHICH THIS TRAIN IS AWAY FROM A STATION
            //THIS IS THE TIME LEFT TO GET TO THIS STATION
            var waitTime = response.arrivalTime - response.time;
            var currentTimeArray = timesArray.filter(function(timeArr){
              return (timeArr.line_id === response.fullrouteID)
            })[0]
            var station1Time = '';
            var station2Time ='';
            var tempVal = currentTimeArray.data;
            for (var i=0; i <tempVal.length;i++){

              if (tempVal[i].stop_id == response.prev_station){
                station1Time = tempVal[i].time;
              }
              else if(tempVal[i].stop_id == response.station){
                station2Time = tempVal[i].time;
              }
            }
            //TOTAL TRAVEL TIME BETWEEN THE TWO stations
            var travelTime = Math.abs(station1Time - station2Time)
            var percentToUse = Math.abs((waitTime/travelTime))
            if (response.direction == "N"){
              percentToUse = Math.abs(1-percentToUse);
            }
            //Current place on the curve
            var currentPos =  segmentLine.GetPointAtDistance(segmentLine.Distance()*(percentToUse));
            var currentIndex =  segmentLine.GetIndexAtDistance(segmentLine.Distance()*(percentToUse));
            if (segmentLine.getPath().length ==1) {
            }
            var heading = segmentLine.Bearing(currentIndex)
            var orthogonalHeading = heading;
            if (response.direction == "N"){
              orthogonalHeading +=90;
            }
            else{
              orthogonalHeading-=90;
            }

            var offset = 0.00001;
            var newPos = getFinalPoint(currentPos, offset, orthogonalHeading)

            var trainMarker = new google.maps.Marker({
                position:newPos,
                map: map,
                icon: movementIcon(routeId, response.direction),
                label: routeId + direction, // + " " + percentToUse,
                size: new google.maps.Size(5, 5)
              });
            trains.push(trainMarker);
          }

          showOrHideMarkers(trainLinesToHide, trainMarker);

          trains.push(trainMarker);

        });
      }
    }
  })
}

function getFinalPoint(point, offset, degHeading){
    Math.degrees = function(rad) {
        return rad * (180 / Math.PI);
    }
    Math.radians = function(deg) {
        return deg * (Math.PI / 180);
    }
    var lat1 = Math.radians(point.lat());
    var lng1 = Math.radians(point.lng());

    var heading = Math.radians(degHeading);

    var latFinal = Math.asin(Math.sin(lat1) * Math.cos(offset) +
                       Math.cos(lat1) * Math.sin(offset) * Math.cos(heading));

    var lonFinal = lng1 + Math.atan2(Math.sin(heading) * Math.sin(offset) *
                      Math.cos(lat1),
                      Math.cos(offset) - Math.sin(lat1) *
                      Math.sin(latFinal));
    return new google.maps.LatLng(Math.degrees(latFinal), Math.degrees(lonFinal));
}

function getCoordinatesOfStation(station){
  return {lat:station[0].getPosition().lat(), lng:station[0].getPosition().lng()}
}

function showStationInfo(marker, station) {
    var proxy = 'https://cors-anywhere.herokuapp.com/';
    var url = "http://apps.mta.info/trainTime/getTimesByStation.aspx?stationID="+station.stop_id+"&time="+ (new Date).getTime();
    $.ajax({
      url: proxy + url,
      method: 'get',
    })
    .done(function(responseJSON){
        var data = responseJSON.replace('loadNewData()', '')
        // var data = responseJSON.replace('tryAgain()', '')
        var direction1 = [];
        var direction2 = [];
        var direction1Label;
        var direction2Label;
        var serverTimeStamp;
        var fileTimeStamp;
        var fileTimeFormat;
        var suspended;
        var ageOfDataAtRead;
        eval(data);
        var nextDirection1TrainTime = direction1[0].split(',')[1];
        var nextDirection1TrainName = direction1[0][0];
        if(minutesFromNow(nextDirection1TrainTime) < 0) {
          nextDirection1TrainTime = direction1[1].split(',')[1];
          nextDirection1TrainName = direction1[1][0];
        }
        var nextDirection2TrainTime = direction2[0].split(',')[1];
        var nextDirection2TrainName = direction2[0][0];
        if(minutesFromNow(nextDirection2TrainTime) < 0) {
          nextDirection2TrainTime = direction2[1].split(',')[1];
          nextDirection2TrainName = direction2[1][0];
        }
        var messagePart1 = 'Next ' + direction1Label + ' train in ' + minutesFromNow(nextDirection1TrainTime) + ' minutes'
        var messagePart2 = 'Next ' + direction2Label + ' train in ' + minutesFromNow(nextDirection2TrainTime) + ' minutes'
        var infoWindow = new google.maps.InfoWindow({
          content: messagePart1 + "\n" + messagePart2
        });
        infoWindow.open(map, marker)
    })
    .fail(function(failure){
      debugger;
    });
  }
