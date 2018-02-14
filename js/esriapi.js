define([
    "esri/layers/ArcGISDynamicMapServiceLayer", "esri/geometry/Extent", "esri/SpatialReference", "esri/tasks/query" ,"esri/tasks/QueryTask", "dojo/_base/declare", "esri/layers/FeatureLayer", 
    "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol","esri/symbols/SimpleMarkerSymbol", "esri/graphic", "dojo/_base/Color"
],
function (     ArcGISDynamicMapServiceLayer, Extent, SpatialReference, Query, QueryTask, declare, FeatureLayer, 
            SimpleLineSymbol, SimpleFillSymbol, SimpleMarkerSymbol, Graphic, Color ) {
        "use strict";

        return declare(null, {
            esriApiFunctions: function(t){    
                // zoom to tracker
                t.zoomTo = 'no';
                // Add dynamic map service
                t.dynamicLayer = new ArcGISDynamicMapServiceLayer(t.url, {opacity:0.8});
                if (t.obj.startingVisibleLayers.length >0){    
                    console.log("starting vis = " + t.obj.startingVisibleLayers)
                    t.dynamicLayer.setVisibleLayers(t.obj.startingVisibleLayers);
                }
                else{t.dynamicLayer.setVisibleLayers[-1];}
                t.map.addLayer(t.dynamicLayer);
                t.dynamicLayer.on("load", function () {             
                    t.layersArray = t.dynamicLayer.layerInfos;
                    console.log(t.layersArray);
                    // Save and Share Handler                    
                    if (t.obj.stateSet == "yes"){
                        //extent
                        var extent = new Extent(t.obj.extent.xmin, t.obj.extent.ymin, t.obj.extent.xmax, t.obj.extent.ymax, new SpatialReference({ wkid:4326 }));
                        t.map.setExtent(extent, true);
                        // accordion visibility
                        $('#' + t.id + t.obj.accordVisible).show();
                        $('#' + t.id + t.obj.accordHidden).hide();
                        $('#' + t.id + 'getHelpBtn').html(t.obj.buttonText);
                        t.clicks.updateAccord(t);
                        $('#' + t.id + t.obj.accordVisible).accordion( "option", "active", t.obj.accordActive );    
                        t.obj.stateSet = "no";
                    }    
                    t.map.setMapCursor("pointer");
                });                    
            },
            commaSeparateNumber: function(val){
                while (/(\d+)(\d{3})/.test(val.toString())){
                    val = val.toString().replace(/(\d+)(\d{3})/, '$1'+','+'$2');
                }
                return val;
            }
        });
    }
);