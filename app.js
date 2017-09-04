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
            products: function(appService) {
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
    
    $rootScope.$on('$routeChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
        $rootScope.hideSpinner();
    });

    $rootScope.productsPage = 1;
    $rootScope.productsCount = 100;
}]);

offersheet.controller('imageModalController', ['$scope', '$uibModalInstance', function($scope, $uibModalInstance) {
    $scope.imageUrl = "https://akamaicdn3.shoplc.com/LCProdImage/LCProdImage/";
}]);

// main app controller
offersheet.controller('appController', ['$scope', '$rootScope', 'products', 'appService', 'alertService', '$timeout', 'utils', '$uibModal',function($scope, $rootScope, products, appService, alertService, $timeout, utils, $uibModal) {
    var timeout; // timeout initialization for event debouncing
    $scope.shadowProducts = {};
    $scope.shadowProducts = angular.copy(products);

    // initialize controller setup
    init();

    /**
     * 
     * initializes the controller local setup
     */
    function init() {
        // scope var bindings
        $scope.products = products;
        $scope.isLoading = false;
        $scope.productHeaders = $scope.products['header'];
        $scope.recordCount = products.total;
        $scope.isUpdating = false;
        $scope.loadNextShift = loadNextShift;
        $scope.openImageModal = openImageModal;

        // scope methods binding
        $scope.updateData = updateData;
        if($scope.products) {
            //clean the products data and show success
            delete $scope.products['header'];
            delete $scope.products['total'];
            alertService.alertSuccess('data loaded successfully!');

            // $scope.loadNextShift();
        } else {
            // log error and show alert
            alertService.alertFailure('failed to load data!');
        }
    }

    function openImageModal(imageUrl) {
        $uibModal.open({
            templateUrl: './templates/imageModal.html',
            controller: 'imageModalController',
            appendTo: $('body'),
            backdrop: true,
            resolve : {
                imageName: function() {
                    return imageUrl;
                }
            }
        });
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
                $scope.recordCount += res.total;
                delete res['header'];
                delete res['total'];
                if(res) {
                    // write check for the length of the returned response
                    if((utils.getObjlength(res) > 0)) {
                        angular.extend($scope.products, res);
                        $scope.shadowProducts = angular.copy($scope.products);
                        $rootScope.productsPage++;
                        $scope.loadNextShift();
                    }
                    else if(!(utils.getObjlength(res) > 0)) {
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
    function updateData(key,value, prop, index) {
        //clear timeout as soon as user types again within a second
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            //code in this block will execute once user has not typed anything for one second

            // check if the value entered has actually changed the initial value
            if($scope.products[key][prop] == $scope.shadowProducts[key][prop]) {
                alertService.alertFailure('field value is unchanged!');
                return;
            }

            // check if the value entered is numeric
            var str = value[prop];
            for(var i= 0; i< (str.length); i++) {
                if(str.charCodeAt(i) <48 || str.charCodeAt(i) >57) {
                    // show alert and return input is invalid
                    $scope.$apply(function() {
                        $scope.products[key][prop] = $scope.shadowProducts[key][prop];
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
            appService.updateData(key,value)
            .then(function(res) {
                if(res.data && res.message == "success") {
                    // on success bind data, update ui to hide loader and enable all inputs
                    // -------------------------------------
                    $scope.$apply(function() {
                        $scope.isUpdating = false;
                    });
                    alertService.alertSuccess('data updated successfully!');
                    $scope.products[key][prop] = res.data[prop];
                    $scope.shadowProducts[key][prop] = $scope.products[key][prop];
                    $('#loader_'+ prop + index).hide();
                    $('#input_'+ prop + index).show();
                    // -------------------------------------
                }
            })
            .catch(function(err) {
                alertService.alertFailure('failed to update data!');
                console.log(err);
            });
        }, 500);
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
    this.updateData = function(key, value) {
        var payload = JSON.stringify(value);
        return new Promise(function(resolve, reject) {
            jQuery.ajax({
                url: "http://115.113.189.18/vglorder/vpop_dev/offersheet/api/1.0/vgl_offer_sheet/" + key,
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