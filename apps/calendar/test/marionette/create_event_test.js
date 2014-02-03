'use strict';

var Calendar = require('./calendar'),
    assert = require('chai').assert;


// test is disabled see: Bug 919066
marionette('creating an event', function() {
  var app;
  var client = marionette.client();

  // we always use today as base day to make test simpler, we also
  // set the hours/minutes so it always shows up at first hours of event list
  // (avoids conflicts with click events)
  var startDate = new Date(), endDate = new Date();
  startDate.setHours(2);
  startDate.setMinutes(0);
  startDate.setSeconds(0);
  startDate.setMilliseconds(0);
  endDate.setTime(startDate.getTime() + 60 * 60 * 1000 /* one hour */);
  var sourceData = {
    title: 'Puppy Bowl dogefortlongtextfotestloremipsumdolorsitamet',
    location: 'Animal Planet reallylongwordthatshouldnotoverflowbecausewewrap',
    description: 'lorem ipsum dolor sit amet maecennas ullamcor',
    startDate: startDate,
    endDate: endDate
  };

  function createEvent(evtData) {
    app.createEvent(evtData);
    // FIXME: temporary hack for keyboard while Bug 965131 is fixed
    app.waitForKeyboardHide();
  }

  setup(function() {
    app = new Calendar(client);
    app.launch({ hideSwipeHint: true });
  });

  suite('vanilla event', function() {
    setup(function(){
      createEvent(sourceData);
      app.waitForMonthView();
    });

    test('should show event in month view', function() {
      var event = app.waitForElement('monthViewDayEvent');
      var title = app.waitForChild(event, 'monthViewDayEventName');
      var location = app.waitForChild(event, 'monthViewDayEventLocation');
      assert.equal(title.text(), sourceData.title);
      assert.equal(location.text(), sourceData.location);
    });
  });

  suite('view event', function() {

    setup(function() {
      createEvent(sourceData);
      app.waitForMonthView();
      // we change to week view because some months spans through 6 rows which
      // makes the click event on "monthViewDayEvent" trigger the wrong link
      app.waitForElement('weekButton').click();
      app.waitForWeekView();
      app.waitForElement('weekViewEvent').click();
    });

    test('should display the created event in read-only view', function() {
      var actual = app.getViewEventEvent();
      assert.deepEqual(actual, {
        calendar: 'Offline calendar',
        title: sourceData.title,
        location: sourceData.location,
        description: sourceData.description
      }, 'event data should match');
    });

    test('should not overflow title, location and description',
      function() {
        app.checkOverflow('viewEventViewTitle', 'title');
        app.checkOverflow('viewEventViewLocation', 'location');
        app.checkOverflow('viewEventViewDescription', 'description');
      });

  });

  function setSystemTime(date, done) {
    // mozTime is only available to privileged apps
    var chrome = client.scope({ context: 'chrome' });
    // client.executeScript(function(){ navigator.mozTime.set(new Date(2014,0,31)); });
    chrome.executeAsyncScript(function(time) {
      window.addEventListener('moztimechange', function(e) {
        marionetteScriptFinished(e);
      });
      // moztimechange is not being dispatched
      // var count = 0;
      // function check() {
        // count += 1;
        // var now = Date.now();
        // if (now + 10000 > time && now - 10000 < time) {
          // marionetteScriptFinished(now);
        // } else if (count > 5) {
          // throw new Error(now + ' - '+ time);
        // } else {
          // window.setTimeout(check, 10);
        // }
      // }
      // check();
      window.navigator.mozTime.set(time);
      window.setTimeout(function(){
        marionetteScriptFinished(Date.now());
      }, 10);

    }, [Number(date)], function(err, val){
      if (err) {
        throw err;
      }
      console.log('date: '+ val);
      done();
    });
  }

  // see Bug 966516
  suite('create event on next month', function() {

    setup(function(done) {
      client.switchToFrame();
      client.apps.close(Calendar.ORIGIN);
      var settingsOrigin = 'app://settings.gaiamobile.org';
      client.apps.launch(settingsOrigin);
      client.apps.switchToApp(settingsOrigin);
      client.helper.waitForElement('#menuItem-dateAndTime').click();
      client.helper.waitForElement('#dateTime #date-picker').click();
        // scriptWith(function(el) {
        // el.value = '2013-01-31';
      // });
      // client.switchToFrame();
      // client.apps.close(settingsOrigin);
      // client.apps.launch(Calendar.ORIGIN);
      // client.apps.switchToApp(Calendar.ORIGIN);
      // done();
    });

    setup(function(done) {
      // setSystemTime(new Date(2014, 0, 29), function() {
        // var startDate = new Date(2014, 1, 28);
        // createEvent({
          // title: 'Bug 966516',
          // location: 'Somewhere',
          // description: 'displays wrong date if next month have less days',
          // startDate: startDate,
          // endDate: startDate,
          // save: false
        // });
        app.waitForElement('addEventButton').click();
        console.log('before tap')
        client.helper.wait(1000);
        app.waitForElement('editEventStartDateButton').click();
        console.log('tapped')
        // need to go back to top most frame
        client.switchToFrame();

        var monthPickerWrapper = client.helper
          .waitForElement('#spin-date-picker .value-picker-month-wrapper');
        var monthPicker = client.helper
          .waitForElement('#spin-date-picker .value-picker-month');

        client.helper.wait(1000);

        var pickerLocation = monthPickerWrapper.location();
        var pickerSize = monthPickerWrapper.size();
        var x = Math.round(pickerLocation.x + (pickerSize.x / 2));
        var startY = pickerLocation.y + pickerSize.y - 10;
        var endY = startY - 30;
        app.actions
          .flick(monthPicker, x, startY, x, endY)
          .perform();

        client
          .findElement('#spin-date-picker-buttons .value-option-confirm')
          .click();

        client.apps.switchToApp(Calendar.ORIGIN);
        done();
      // });
    });

    test.only('it should display the proper date after pick', function(done){
      // .executeScript(function(){
        // window.navigator.mozTime.set(new Date(2014,0,31));
      // });

      var val = app.findElement('editEventStartDate').scriptWith(function(el) {
        return el.value;
      });
      assert.equal(val, '2014-02-28', 'input value');
      var text = app.findElement('editEventStartDateLocale').text();
      assert.equal(text, '02/28/2014', 'displayed text');
    });

  });

});
