
var platform = Ti.Platform.osname;

var MASlidingMenu = function(args) {
    var self = Ti.UI.createWindow({exitOnClose:false});

    var left = args.left,
        view, //the current view... start with 0
        views = [],
        menuRows = [],
        events = {}, //holder for our custom events
        draggable = args.draggable || true,
        ledge,
        threshold,
        half = {
            width: undefined,
            height: undefined
        },
        duration = {
            slide: 200,
            swipe: 150,
            bounce: 100,
            change_out: 120,
            change_in: 300
        },
        bounce = 8,
        shadow = {
            shadowRadius: 2,
            shadowOpacity: 0.6,
            shadowOffset: {
                x: 4,
                y: 0
            },
            shadowColor: 'black'
        },
        current = 'view',
        sliding = {
            center: 0,
            offset: 0
        };

    // Our Identity Matrix for all animations using transform
    var twoD = Ti.UI.create2DMatrix();

    var open = function() {

        // Add the menu first
        if(left !== undefined && left.toString().indexOf('TableView') !== -1) {
            self.add(left);
        } else {
            throw "'left' property must be a Titanium Table view proxy... was:" + left.toString();
        }

        // Here we will process the table rows just as if they were tabs in a tabgroup
        // Making sure we check all the table sections
        for(var i = 0; i < left.data.length; i++)
        {
            // Make sure we check all the table rows
            for(var j = 0; j < left.data[i].rowCount; j++)
            {
                var row = left.data[i].rows[j];

                //only work with rows that have a view... in case some are buttons or decoration
                if(row.navView !== undefined) {
                    var View;

                    // here we will accept nything but a window...
                    if(row.navView.toString().indexOf('Window') === -1) {
                        View = row.navView;
                    } else {
                        throw "ViewSlider can only accept UI Views as the table row view property for now";
                        //Maybe in the future just copy all children of a window to a view?
                    }
                    View.width = Ti.Platform.displayCaps.platformWidth;
                    View.height = Ti.UI.FILL;

                    views.push(View);

                    // Hide all but the first one... but add them to self so they load and reduce lag... just like ios tabgroup...
                    self.add(View);
                    if(views.length > 1) {
                        View.visible = false;
                    }

                } else {
                    views.push({}); // keep our index correct...
                }
            }
        }
        view = views[0]; // set the first view

        ledge = view.width * 0.8,
        threshold = view.width * 0.2,
        half = {
            width: view.width / 2,
            height: view.height / 2
        };
        left.zIndex = 1;
        view.zIndex = 2;

        if(draggable) {
            addEvents();
        }

        left.addEventListener('click', function(e) {
            var newView;
            if(views[e.index].toString() !== "object") {
                newView = views[e.index];
                changeView(newView);
            }

            fireEvent('switch', {
                view: newView,
                index: views.indexOf(newView),
                menuRow: e.rowData
            });
        });
        addEventListener('open', function() {
            slideView('left');
        });
        addEventListener('close', function() {
            slideView('view');
        });
        addEventListener('toggle', function() {
            if(current === 'view') {
                slideView('left');
            } else {
                slideView('view');
            }
        });
        self.open();
    };

    var addEventListener = function(name, callback) {
        if(typeof events[name] !== 'array') {
            events[name] = [];
        }

        events[name].push(callback);
    };

    var fireEvent = function(name, args) {
        args.event = name;
        for(var callback in events[name]) {
            events[name][callback](args);
        }
    };

    var onCurrentChanged = function() {
        shadow.shadowOffset.x = -4;
        left.zIndex = -1;
    };

    var slideView = function(position) {

        var delta_xs;
        delta_xs = {
            left: ledge,
            view: 0
        };
        view.animate({
            center: {
                x: delta_xs[position] + half.width,
                y: half.height
            },
            duration: duration.slide
        });
        current = position;
        onCurrentChanged();
    };

    var viewTouchstart = function(e) {
        Ti.API.info('starting');
        sliding.offset = e.x - half.width;
        sliding.center = view.rect.x + half.width;
    };

    var viewTouchmove = function(e) {
        var delta_x;

        delta_x = e.x - sliding.offset + view.rect.x;
        delta_x -= half.width;

        touchStarted = false;

        // //Minimum movement is 30
        if( delta_x > 30 ){
            touchStarted = true;
        }

        if(touchStarted) {

            fireEvent('sliding', {
                distance: delta_x
            });

            if ((delta_x > 0 && !left)) {
                return;
            }
            if (Math.abs(delta_x) > ledge) {
                return;
            }
            if (delta_x > 0 && current !== 'left') {
                current = 'left';
                onCurrentChanged();
            } else if (delta_x === 0 && current !== 'view') {
                current = 'view';
                onCurrentChanged();
            }

            view.animate({
                transform: twoD.translate(delta_x, 0),
                duration: 0
            });

        }

    };

    var viewTouchend = function(e) {
        var delta_x;

        delta_x = e.x - sliding.offset + view.rect.x ;
        delta_x -= half.width;

        if ((delta_x > 0 && !left)) {
            return;
        }
        if (Math.abs(delta_x) > ledge) {
            return;
        }

        if(sliding.center - half.width === 0 && delta_x > threshold) {
            Ti.API.info('1');
            if (delta_x > 0) {
                delta_x = ledge;
                current = 'left';
            } else {
                delta_x = 0;
                current = 'view';
            }

            view.animate({
                transform: twoD.translate(260, 0),
                duration: duration.bounce
            });
        } else {
            delta_x = sliding.center - half.width;
            if (delta_x === 0) {
                current = 'view';
            } else if (delta_x > 0) {
                current = 'left';
            }
            view.animate({
                transform: twoD.translate(0, 0),
                duration: duration.swipe
            });
        }
        onCurrentChanged();
    };

    var addEvents = function() {
        if(view.toString() === "[object TiUIiPhoneNavigationGroup]") {
            view.window.addEventListener('touchstart', viewTouchstart);
            view.window.addEventListener('touchmove', viewTouchmove);
            view.window.addEventListener('touchend', viewTouchend);
            view.window.addEventListener('touchcancel', viewTouchend);
        } else {
            view.addEventListener('touchstart', viewTouchstart);
            view.addEventListener('touchmove', viewTouchmove);
            view.addEventListener('touchend', viewTouchend);
            view.addEventListener('touchcancel', viewTouchend);
        }
    };

    var removeEvents = function() {
        if(view.toString() === "[object TiUIiPhoneNavigationGroup]") {
            view.window.removeEventListener('touchstart', viewTouchstart);
            view.window.removeEventListener('touchmove', viewTouchmove);
            view.window.removeEventListener('touchend', viewTouchend);
        } else {
            view.removeEventListener('touchstart', viewTouchstart);
            view.removeEventListener('touchmove', viewTouchmove);
            view.removeEventListener('touchend', viewTouchend);
        }
    };

    var changeView = function(newView) {
        if (view !== newView) {
            newView.hide();
            newView.center = {
                x: half.width,
                y: half.height
            };
            newView.width = Ti.Platform.displayCaps.platformWidth;
            newView.height = Ti.UI.FILL;
        }

        view.animate({
            transform: twoD.translate(view.rect.x + (Ti.Platform.displayCaps.platformWidth - view.rect.x), 0), //twoD.translate(delta_x, 0),
            duration: duration.change_out
        }, function() {

            if(draggable) {
                removeEvents();
            }
            view.hide();
            view = newView;
            current = 'view';
            view.show();

            if(draggable) {
                addEvents();
            }
            view.animate({
                transform: twoD.translate(0, 0),
                duration: duration.change_in
            });
        });
    };


    // API properties
    this.draggable = draggable;

    // API methods
    this.slideView = slideView;
    this.addEventListener = addEventListener;
    this.fireEvent = fireEvent;
    this.open = open;
    this.activeView = function() {
        return view;
    };
};

module.exports = MASlidingMenu;