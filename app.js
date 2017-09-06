// app bootstraps here
var offersheet = angular.module('offersheet',['ngRoute', 'ui.bootstrap']);
//ui-router not required as their is only one screen in the app

// global config for bootstraping the app
offersheet.config(['$routeProvider', function($routeProvider){
    $routeProvider
    .when('/',{
        templateUrl:'./templates/offersheet.html',
        controller: 'appController as app',
        resolve: {
            data: function(appService) {
                return appService.getAllData(0, 100);
            }
        }
    })
    .otherwise({redirectTo:'/'});
}]);



// initial code for app bootstrapings
offersheet.run(['$rootScope', function($rootScope) {
    $rootScope.hideSpinner = function() {
        $('#mainLoader').hide();
    }
    
    // on route change success
    $rootScope.$on('$routeChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
        $rootScope.hideSpinner();
    });

    // on route change error
    $rootScope.$on('$routeChangeError', function(event, toState, toParams, fromState, fromParams, error){ 
            // this is required if you want to prevent the $UrlRouter reverting the URL to the previous valid location
            event.preventDefault();
            $rootScope.hideSpinner();
            alertService.alertFailure('failed to load data!');

    });

    $rootScope.productsPage = 1;
    $rootScope.productsCount = 100;
}]);




// contoller for image modal popup
offersheet.controller('imageModalController', ['$scope', '$uibModalInstance', 'value', function($scope, $uibModalInstance, value) {
    $scope.value = value;
    $scope.imageUrl = "https://akamaicdn3.shoplc.com/LCProdImage/LCProdImage/" + $scope.value.image;
    $scope.close = function() {
        $uibModalInstance.close();
    }
}]);




// main app controller
offersheet.controller('appController', ['$scope', '$rootScope', 'data', 'appService', 'alertService', '$timeout', 'utils', '$uibModal',function($scope, $rootScope, data, appService, alertService, $timeout, utils, $uibModal) {
    var timeout; // timeout initialization for event debouncing
    $scope.shadowProducts = {};
    $scope.shadowProducts = angular.copy(data.data);// this is for the purpose of flashbacks and model comparisons

    // initialize controller setup
    init();

    /**
     * 
     * initializes the controller local setup
     */
    function init() {
        // scope var bindings
        $scope.products = data.data;
        $scope.isLoading = false;
        $scope.productHeaders = data.info.headers;
        $scope.recordCount = data.info.total;
        $scope.isUpdating = false;

        // scope method binding
        $scope.updateData = updateData;
        $scope.loadNextShift = loadNextShift;
        $scope.loadAllInSecondShift = loadAllInSecondShift;
        $scope.openImageModal = openImageModal;


        if($scope.products) {
            //clean the products data and show success
            alertService.alertSuccess('data loaded successfully!');
            $scope.loadAllInSecondShift();
        } else {
            // log error and show alert
            alertService.alertFailure('failed to load data!');
        }
    }

    // method to open the image modal popup
    function openImageModal(value) {
        $uibModal.open({
            templateUrl: './templates/imageModal.html',
            controller: 'imageModalController',
            resolve: {
                value : function() {
                    return value;
                },

            }
        });
        $timeout(function() {
            $('.modal').removeClass('fade');
        }, 100);
    }

    function loadAllInSecondShift() {
        var allPromiseArray = [];
        for(var i=0; i<=10; i++) {
            allPromiseArray.push(appService.getAllData($rootScope.productsPage, $rootScope.productsCount));
            $rootScope.productsPage++;
        }

        Promise.all(allPromiseArray).then(function(data) {
            data.forEach(function(ele) {
                 $scope.shadowProducts = $scope.shadowProducts.concat(ele.data);
            });
            $timeout(function() {
                $scope.products = $scope.shadowProducts;
            }, 0);
        }).catch(function(err) {
            console.log(err);
            throw err;
        })
    }

    /**
     * loads the table data in shifts using pagination
     * 
     * @param {Number} page  offset for pagination
     * @param {Number} count limit for pagination
     */
    function loadNextShift() {
        // The delay in next load helps keeping other update activites fast and safe
        $timeout(function() {
            appService.getAllData($rootScope.productsPage, $rootScope.productsCount)
            .then(function(res) {
                $scope.recordCount += res.info.total;
                if(res) {
                    // write check for the length of the returned response
                    if(res.data.length > 0) {
                        $scope.products = $scope.products.concat(res.data);
                        $scope.shadowProducts = angular.copy($scope.products);
                        $rootScope.productsPage++;
                        $scope.loadNextShift();
                    }
                    else if(!((res.data.length) > 0)) {
                        alertService.alertSuccess('all data loaded successfully!');
                        return;
                    }
                }
            })
            .catch(function(err) {
                alertService.alertFailure('loading data failed on page' + $rootScope.productsPage+1);
            });
        }, 0);
    }


    /**
     * 
     * @param {String} key      object key for the current row
     * @param {Object} value    current row data
     * @param {String} prop     prop name for the colume to be updated
     * @param {Number} index    index of current row
     */
    function updateData(nid, value, prop, index) {
        //clear timeout aearTimeout(times soon as user types again within a second
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            //code in this block will execute once user has not typed anything for one second

            // check if the value entered has actually changed the initial value
            if($scope.products[index][prop] == $scope.shadowProducts[index][prop]) {
                alertService.alertFailure('field value is unchanged!');
                return;
            }

            // check if the value entered is numeric
            var str = value[prop];
            for(var i= 0; i< (str.length); i++) {
                if(str.charCodeAt(i) <48 || str.charCodeAt(i) >57) {
                    // show alert and return input is invalid
                    $scope.$apply(function() {
                        $scope.products[index][prop] = $scope.shadowProducts[index][prop];
                    });
                    alertService.alertFailure('failed to update data! Only numbers Allowed!');
                    return;
                }
            }

            // if all good update ui to show loader in the active input and disable all other inputs
            $('#loader_'+ prop + index).show();
            $('#input_'+ prop + index).hide();
            $scope.isUpdating = true;
            // hit the api for updation
            appService.updateData(nid,value)
            .then(function(res) {
                if(res.data && res.message == "success") {
                    // on success bind data, update ui to hide loader and enable all inputs
                    // -------------------------------------
                    $scope.$apply(function() {
                        $scope.isUpdating = false;
                    });
                    alertService.alertSuccess('data updated successfully!');
                    $scope.products[index][prop] = res.data[prop];
                    $scope.shadowProducts[index][prop] = $scope.products[index][prop];
                    $('#loader_'+ prop + index).hide();
                    $('#input_'+ prop + index).show();
                    // -------------------------------------
                }
            })
            .catch(function(err) {
                alertService.alertFailure('failed to update data!');
                console.log(err);
            });
        }, 1000);
    }
}]);

// services for the service requests
offersheet.service('appService', ['$http', function($http) {
    //get all data from api
    this.getAllData = function(offset, limit) {
        return new Promise(function(resolve, reject) {
            $.get( "http://115.113.189.18/vglorder/vpop_dev/offersheet/api/1.0/vgl_offer_sheet/1/2019/" + offset + "/" + limit, function( data ) {
                if(data) {
                    resolve(data);
                } else {
                    reject('failed to load data!');
                }
              });
        });
    };

    // update data from table grid
    this.updateData = function(nid, value) {
        var payload = JSON.stringify(value);
        return new Promise(function(resolve, reject) {
            jQuery.ajax({
                url: "http://115.113.189.18/vglorder/vpop_dev/offersheet/api/1.0/vgl_offer_sheet/" + nid,
                type: 'PUT',
                contentType: "application/json",
                data: payload,
                success: function(res) {
                    if(res) {
                        resolve(res);
                    }
                }
              });
        });
    };
}]);



// alert service
offersheet.service('alertService', ['$timeout', function($timeout) {
    this.alertSuccess = function successHandler(msg) {
        $('.alert-success').html(msg).fadeIn();
        $timeout(function() {
            $('.alert-success').fadeOut();
        }, 2000);
    };

    this.alertFailure = function errorHandler(msg) {
        $('.alert-danger').html(msg).fadeIn();
        $timeout(function() {
            $('.alert-danger').fadeOut();
        }, 2000);
    };
}]);



// service for utilites
offersheet.service('utils', function() {
    // method to check the length of an oject i.e., the count of the keys it has
    this.getObjlength = function(obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    };

    // method implementating the debounce functionality
    this.debounce = function debounce(func, wait, immediate) {
        // 'private' variable for instance
        // The returned function will be able to reference this due to closure.
        // Each call to the returned function will share this common timer.
        var timeout;           
        // Calling debounce returns a new anonymous function
        return function() {
            // reference the context and args for the setTimeout function
            var context = this, 
                args = arguments;
            // Should the function be called now? If immediate is true
            //   and not already in a timeout then the answer is: Yes
            var callNow = immediate && !timeout;
            // This is the basic debounce behaviour where you can call this 
            //   function several times, but it will only execute once 
            //   [before or after imposing a delay]. 
            //   Each time the returned function is called, the timer starts over.
            clearTimeout(timeout);   
            // Set the new timeout
            timeout = setTimeout(function() {
                 // Inside the timeout function, clear the timeout variable
                 // which will let the next execution run when in 'immediate' mode
                 timeout = null;
                 // Check if the function already ran with the immediate flag
                 if (!immediate) {
                   // Call the original function with apply
                   // apply lets you define the 'this' object as well as the arguments 
                   //    (both captured before setTimeout)
                   func.apply(context, args);
                 }
            }, wait);
            // Immediate mode and no wait timer? Execute the function..
            if (callNow) func.apply(context, args);  
         }; 
    };
});


// custom filter for implementing default angular filters for ng-repeat over object
offersheet.filter('toArray', function () {
    return function (obj, addKey) {
      if (!(obj instanceof Object)) {
        return obj;
      }
  
      if ( addKey === false ) {
        return Object.values(obj);
      } else {
        return Object.keys(obj).map(function (key) {
          return Object.defineProperty(obj[key], '$key', { enumerable: false, value: key});
        });
      }
    };
  });