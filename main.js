// Pull in your favorite version of jquery 
require({ 
    packages: [{ name: "jquery", location: "https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/", main: "jquery.min" }] 
});
// Bring in dojo and javascript api classes as well as varObject.json, js files, and content.html
define([
    "dojo/_base/declare", "dojo/_base/lang", "dojo/_base/Color",  "dojo/_base/array", "framework/PluginBase", "dijit/layout/ContentPane", "dojo/dom", 
    "dojo/dom-style", "dojo/dom-geometry",  "dojo/text!./obj.json", "dojo/text!./html/content.html",  './js/clicks', 
    'dojo/text!./config.json', 'dojo/text!./filters.json', 'dojo/text!./photos.json',"esri/layers/ImageParameters", "esri/layers/FeatureLayer", "esri/layers/GraphicsLayer",
     "esri/layers/ArcGISDynamicMapServiceLayer",  "esri/graphic", "esri/symbols/SimpleMarkerSymbol", "esri/tasks/Geoprocessor", "esri/tasks/IdentifyTask", "esri/tasks/IdentifyParameters", "esri/InfoTemplate",
     "esri/renderers/SimpleRenderer", "esri/geometry/Extent", "esri/geometry/webMercatorUtils", "esri/SpatialReference","esri/tasks/query", "esri/tasks/QueryTask", "esri/layers/LayerInfo", "dijit/Dialog"
],
function (declare, lang, Color, arrayUtils, PluginBase, ContentPane, dom, domStyle, domGeom, obj, content,  Clicks,  config, 
    filters, photos, ImageParameters, FeatureLayer, GraphicsLayer, ArcGISDynamicMapServiceLayer, Graphic, SimpleMarkerSymbol, Geoprocessor, IdentifyTask, 
    IdentifyParameters, InfoTemplate, SimpleRenderer, Extent, webMercatorUtils, SpatialReference, Query, QueryTask, LayerInfo, Dialog) {
    return declare(PluginBase, {
        // The height and width are set here when an infographic is defined. When the user click Continue it rebuilds the app window with whatever you put in.
        toolbarName: "Aquatic Barrier Prioritization", showServiceLayersInLegend: true, allowIdentifyWhenActive: true, rendered: false, resizable: false,
        hasCustomPrint: false, size:'small',
        
        // First function called when the user clicks the pluging icon. 
        initialize: function (frameworkParameters) {
            //only show the "x" not the "_" minimize
            $('.plugin-minimize').hide();
            
            // Access framework parameters
            declare.safeMixin(this, frameworkParameters);
            // Define object to access global variables from JSON object. Only add variables to varObject.json that are needed by Save and Share. 
            this.obj = dojo.eval("[" + obj + "]")[0];    
            this.config = dojo.eval("[" + config + "]")[0];
            this.filters = dojo.eval("[" + filters + "]")[0]; 
            this.photoNames = dojo.eval("[" + photos + "]")[0]; 
            this.url = this.config.url;
            this.gp = new Geoprocessor(this.config.gpURL);
            this.gp.setUpdateDelay(200); //status check in milliseconds;
            this.barriers2RemoveCount = 0;   
            this.glanceExtentCount = 0;
            this.exploreTabCounter = 0;
            this.selectSeverityCounter = 0;
            this.zoomCounter=0;
            
            ga('send', 'event', {
                eventCategory:this.config.analyticsEventTrackingCategory,        
                eventAction: 'App open', 
                eventLabel: "App open" 
            }); 
        },
        // Called after initialize at plugin startup (why the tests for undefined). Also called after deactivate when user closes app by clicking X. 
        hibernate: function () {
            if (this.appDiv !== undefined){
                console.log("hibernating");

                this.map.removeLayer(this.prioritizedBarriers);
                this.map.removeLayer(this.glanceBarriers);
                   
                this.map.removeLayer(this.subExtents);
                
                if (this.subsetBarriers){
                    this.map.removeLayer(this.subsetBarriers);
                }  
                if (this.gpResLayer){
                    this.map.removeLayer(this.gpResLayer);
                }
                this.subExtents= "off";
                this.hibernating = "yes";
            }
            this.open = "no";
            
            
            
        },
        // Called after hibernate at app startup. Calls the render function which builds the plugins elements and functions.   
        activate: function () {
            if (this.rendered === false) {
                this.rendered = true;                            
                this.render();
            }else{
                $('#' + this.id).parent().parent().css('display', 'flex');
                this.clicks.updateAccord(this);
            }    
            
            if (this.hibernating === "yes"){
                lang.hitch(this, this.applyStartingTab(this.visibleTab));    
            } 

            this.open = "yes";
        },
        
        // Called when user hits the minimize '_' icon on the pluging. Also called before hibernate when users closes app by clicking 'X'.
        deactivate: function () {
            this.open = "no";    
        },    
        
        // Called when user hits 'Save and Share' button. This creates the url that builds the app at a given state using JSON. 
        // Write anything to you varObject.json file you have tracked during user activity.        
        getState: function () {
            // remove this conditional statement when minimize is added
            if ( $('#' + this.id ).is(":visible") ){
                //tabs
                if ($("#" + this.id + "glance").is(":visible")){this.obj.startingTab = "glance";}
                if ($("#" + this.id + "explore").is(":visible")){this.obj.startingTab = "explore";}
                if ($("#" + this.id + "custom").is(":visible")){this.obj.startingTab = "custom";}
         
                //extent
                this.obj.extent = this.map.geographicExtent;
                this.obj.stateSet = "yes";   
                
                //get the current map layers
                this.obj.startingMapLayers =true;
                $.each(this.obj.startingAdditionalLayers, lang.hitch(this, function(key,value ) {
                    if ($("#" + this.id + key).is(':checked')){
                        if (key !== "barriers"){
                        this.obj.startingAdditionalLayers[key]="on";
                        }
                    }
                }));

                //Get the state/region zoomed into & sceanrio
                this.obj.startingGlanceZoom = $("#" + this.id + "glanceZoom").val();
                this.obj.startingExploreZoom = $("#" + this.id + "exploreZoom").val();
                this.obj.startingExploreScenario = $("#" + this.id + "exploreScenario").val();
                
                //get the current consensus layer (scenario & stratify extent
                this.obj.startingPrioritizedLayerID = this.visibleLayers;
                
                //get starting stratify region
                this.obj.startingStratifyRegion = $('input[name="stratify"]:checked').val();
                
                if (this.config.includeCustomAnalysis ===true){
                    //Get filter
                    this.obj.startingFilter = $("#" + this.id + "userFilter").val();
                    //Get list of barriers to remove
                    this.obj.startingBarriers2Remove = $("#" + this.id + 'barriers2Remove').val();            
                    this.obj.startingRemovingBarriers = this.removingBarriers;
                    this.obj.startingPassability = $("#" + this.id + "passability").val();        

                    
                    this.obj.startingSummarizeBy = $("#" + this.id + "summarizeBy").val();    
                    this.obj.startingSummaryStatField = $("#" + this.id + "summaryStatField").val();    
                    
                    //Get the current weights
                    $("input[id^=" + this.id + "weightIn]").each(lang.hitch(this, function(i, v){
                            var m = v.id.replace(this.id + "weightIn-", "");
                            this.obj.startingWeights[m] = parseInt(v.value, 10);                
                     }));
                    this.obj.startingUseConsensusWeights = $("input[name='useConsensusWeights']:checked").val();  
                    console.log(this.obj.startingWeights)
                }
                
                if (document.getElementById(this.id + 'consensusResultFilterSliderTier')) {
                    this.obj.startingConsensusTierFilterMin =$('#' + this.id + 'consensusResultFilterSliderTier').slider("values", 0);
                    this.obj.startingConsensusTierFilterMax =$('#' + this.id + 'consensusResultFilterSliderTier').slider("values", 1);
                    this.obj.startingUseConsensusFilter = true;
                    if (this.consensusCustomFilter !=="" && this.consensusCustomFilter  !== undefined){this.obj.startingConsensusFilter = this.consensusSliderFilter + " AND " + this.consensusCustomFilter;}
                    else{this.obj.startingConsensusFilter = this.consensusSliderFilter;}
                }

                if (document.getElementById(this.id + 'resultsConsensusFilter')){
                    if ($('#' + this.id + 'resultsConsensusFilter').val() !== ""){
                        this.obj.startingUseConsensusCustomFilter = true;
                        this.obj.startingConsensusCustomFilter = $('#' + this.id + 'resultsConsensusFilter').val();
                        this.obj.startingUseConsensusFilter = true;
                        if (this.consensusSliderFilter !== "" && this.consensusSliderFilter  !== undefined){this.obj.startingConsensusFilter = this.consensusSliderFilter + " AND " + this.consensusCustomFilter;}
                        else{this.obj.startingConsensusFilter = this.consensusCustomFilter;}
                    }    
                    else{
                        this.obj.startingUseConsensusFilter = false;
                        this.obj.startingUseConsensusCustomFilter = false;
                    }
                }
    
                //open the accorions on each tab
                if ( $('#' + this.id + 'mainAccord').is(":visible") ){
                    this.obj.accordVisible = 'mainAccord';
                    this.obj.accordHidden = 'customAccord';
                }else{
                    this.obj.accordVisible = 'customAccord';
                    this.obj.accordHidden = 'mainAccord';
                }    
                this.obj.accordActive = $('#' + this.id + this.obj.accordVisible).accordion( "option", "active" );
                
                var state = {};
                state = this.obj;
                console.log(this.obj);
                return state;    
            }
        },
        // Called before activate only when plugin is started from a getState url. 
        //It's overwrites the default JSON definfed in initialize with the saved stae JSON.
        setState: function (state) {
            this.obj = state;
            this.stateSet = this.obj.stateSet;
            
            console.log(this.obj);
        },
        // Called when the user hits the print icon
        beforePrint: function(printDeferred, $printArea, mapObject) {
            printDeferred.resolve();
        },    
        // Called by activate and builds the plugins elements and functions
        render: function() {  
            //first render: not coming out of hibernation
            if (this.hibernating !== 'yes'){
                this.visibleTab = "glance";
            }
            

            this.mapScale  = this.map.getScale();
            // BRING IN OTHER JS FILES
            this.clicks = new Clicks();

           
            // window popup for metric definition
            window.windowPopup = function(mylink, windowname){
                if (!window.focus)return true;
                    var href;
                if (typeof(mylink) === 'string')
                    href=mylink;
                else
                    href=mylink.href;
                var windowname = window.open(href, windowname, 'width=650,height=590,scrollbars=yes');
                windowname.moveTo(400, 200);
                return false;
                
            };
            //set up a counter so the notes about the scenario are only displayed once
            const keys = Object.keys(this.config.scenarioNotes);
            this.scenNoteCounter = {};
            for (const key of keys) {
              this.scenNoteCounter[key] = 0;
            }
            
            this.scenarioDialog = new Dialog({
	    	id: "scenarioDialog",
	        style: {
                    width : "500px",
                    maxWidth: "700px",
                    overflow: "hidden",
                    border: "1px",
                    background:"white",
                    opacity: "0.5",
                    borderRadius: "5px"
	        }
	    });
            
             
            // ADD HTML TO APP
            // Define Content Pane as HTML parent        
            this.appDiv = new ContentPane({style:'padding:0; color:#000; flex:1; display:flex; flex-direction:column;}'});
            this.id = this.appDiv.id;
            dom.byId(this.container).appendChild(this.appDiv.domNode);    
            $('#' + this.id).parent().addClass('flexColumn');
//            $('#' + this.id).addClass('accord');
            if (this.obj.stateSet === "no"){
                $('#' + this.id).parent().parent().css('display', 'flex');
            }        
            // Get html from content.html, prepend appDiv.id to html element id's, and add to appDiv
            var idUpdate = content.replace(/for="/g, 'for="' + this.id).replace(/id="/g, 'id="' + this.id);   
            $('#' + this.id).html(idUpdate);
            
            //make overflow hidden on content pane to avoid having two vertical scrollbars
            $("#" + this.id).css({overflow: "hidden"});

            //set varaibles
            this.severityDict = this.config.severitySliderDict;
            this.activateIdentify = "";
            this.allowIdentifyWhenActive = false;
            this.uniqueID = this.config.uniqueID;

            this.workingRemoveBarriers = [];
            this.workingRemoveBarriersString = "";
            this.visibleLayers = this.obj.startingPrioritizedLayerID;
            
            if (this.config.includeBarrierSeverity === false){this.currentSeverity = "";}
            this.firstIdentify = 0;
            lang.hitch(this, this.refreshIdentify(this.url));

            // Click listeners
            this.clicks.appSetup(this);
            // fire functions when tabs are clicked
            $("#" + this.id + "glanceTab").click(lang.hitch(this, function(){lang.hitch(this, this.glanceTabClick());}));
            $("#" + this.id + "exploreTab").click(lang.hitch(this, function(){lang.hitch(this, this.exploreTabClick());}));
            $("#" + this.id + "customTab").click(lang.hitch(this, function(){lang.hitch(this, this.customTabClick());}));

            //set up initial layers for display
            lang.hitch(this, this.setupLayers());
            
            //hide elements until they're needed 
            $('#' + this.id + 'gpSumStatsTableDivContainer').hide(); 
            $('#' + this.id + 'downloadCustomContainer').hide();                 
            
            //apply starting stratify region
            if (this.obj.stateSet === "yes"){
                $('input[name="stratify"][value="'+this.obj.startingStratifyRegion+'"]').prop("checked", true);
            }
            
            //Set up the +/- expanders on the custom analysis tab
            this.expandContainers = [ "customFilter", "customMetric", "barrierRemoval", "sumStats"];
            //Hide all expansion containers & set cursor to pointer        
            for (var i=0; i<this.expandContainers.length; i++){
                $("#" + this.id + this.expandContainers[i] + "Container").hide();
                $("#" + this.id + "-" +  this.expandContainers[i] + "Info").hide();
                $("#" + this.id + this.expandContainers[i] + "Expander").css( 'cursor', 'pointer' );
            }
            //on expander click loop through all expanders -- open this one and close all the others.  Also switch +/- 
            $('.bp_expander').on("click", lang.hitch(this, function(e){
                //show the assess a barrier expander if it's hidden, which it is by default
                var expander = e.currentTarget.id;
                var container = e.currentTarget.id.replace("Expander", "Container");
                for (var i=0; i<this.expandContainers.length; i++){
                    if (this.id + this.expandContainers[i]+"Expander" === expander && $("#" + this.id + this.expandContainers[i]+"Container").is(":visible")===false){
                        lang.hitch(this, this.selectorTextReplace(e.currentTarget, "+", "-"));
                        $("#" + this.id + this.expandContainers[i]+"Container").animate({height:"toggle"}, 500);
                        $("#" + this.id + "-" +  this.expandContainers[i] + "Info").animate({height:"toggle"}, 500);                    	
                    }
                    else if ($("#" + this.id + this.expandContainers[i]+"Container").is(":visible")===true){
                        $("#" + this.id + this.expandContainers[i]+"Container").animate({height:"toggle"}, 500);
                        $("#" + this.id + "-" + this.expandContainers[i] + "Info").animate({height:"toggle"}, 500);
                        lang.hitch(this, this.selectorTextReplace("#" + this.id + this.expandContainers[i]+"Expander", "-", "+"));
                    }
                }
            }));


            

            if (this.config.includeExploreConsensus === true){
                //Consensus Tier Slider
                $('#' + this.id + 'consensusResultFilterSliderTier').slider({
                    range:true, 
                    min:1, 
                    max:this.config.maxTierVal, 
                    values: [this.obj.startingConsensusTierFilterMin, this.obj.startingConsensusTierFilterMax],
                    // called at end of slide. use change to ask server for data
                    change:lang.hitch(this,function(event,ui){
                        console.log(ui.values);
                        lang.hitch(this, this.filterConsensusMapServiceSlider());
                        this.consensusResultFilterSliderTierUI = ui;
                    }),
                    // called at each increment of slide
                    slide:lang.hitch(this,function(event,ui){
                        sliderID = '#' + this.id + 'consensusResultFilterSliderTier';
                        lang.hitch(this, this.displaySliderSelectedValues(sliderID, ui));
                    })
                });

                //Consensus Severity Slider
                $('#' + this.id + 'consensusResultFilterSliderSeverity').slider({
                    range:true, 
                    min:1, 
                    max:5, 
                    values: [this.obj.startingConsensusSeverityFilterMin, this.obj.startingConsensusSeverityFilterMax],
                    // called at end of slide. use change to ask server for data
                    change:lang.hitch(this,function(event,ui){
                        console.log(ui.values);
                        lang.hitch(this, this.filterConsensusMapServiceSlider());
                        this.consensusResultFilterSliderSeverityUI = ui;
                    }),
                    // called at each increment of slide
                    slide:lang.hitch(this,function(event,ui){
                        sliderID = '#' + this.id + 'consensusResultFilterSliderSeverity';
                        lang.hitch(this, this.displaySliderSelectedValues(sliderID, ui));
                    })
                });

                //Consensus Results custom filter builder
                this.consensusResultFilterField = "";
                this.consensusResultFilterOperator ="";
                this.consensusResultFilterValue = "";       
                this.consensusResultFilterFieldList = "";

                for (var i=0; i< this.filters.resultFilters.resultFilterFields.length; i++){
                    this.consensusResultFilterFieldList += "<option value='" + this.filters.resultFilters.resultFilterFields[i].resultGISName + "'>" + this.filters.resultFilters.resultFilterFields[i].resultPrettyName + "</option>";
                }
                $("#" + this.id + "filterConsensusResultsField").html(this.consensusResultFilterFieldList);
                    
                this.updateConsensusResultValues = (lang.hitch(this,function (field){    
                    this.fieldValsList = "";
                    for (var i=0; i < this.filters.resultFilters.resultValuesTable[field].length; i++){
                        if (this.filters.resultFilters.resultValuesTable[field][i].resultValuePrettyName !== undefined){
                            this.fieldValsList += "<option value='" + this.filters.resultFilters.resultValuesTable[field][i].resultValue + "'>" + this.filters.resultFilters.resultValuesTable[field][i].resultValuePrettyName + "</option>";
                        }
                        else{
                            this.fieldValsList += "<option value='" + this.filters.resultFilters.resultValuesTable[field][i].resultValue + "'>" + this.filters.resultFilters.resultValuesTable[field][i].resultValue + "</option>";
                        }
                    }
                    $("#" + this.id + "filterConsensusResultsValue").html(this.fieldValsList);        
                        $(".chosen").trigger("chosen:updated");
                        this.consensusResultFilterValue = $("#" + this.id + "filterConsensusResultsValue").val();
                        //set operator to = as a default
                        if (this.consensusResultFilterOperator === ""){
                            $('#'+ this.id +"filterConsensusResultsOperator").val($('#'+ this.id +"filterConsensusResultsOperator option:eq(1)").val());
                             $(".chosen").trigger("chosen:updated");
                            this.consensusResultFilterOperator = $("#" + this.id + "filterConsensusResultsOperator").val();
                        }
                        $("#" + this.id + "resultsConsensusFilter").val( this.consensusResultFilterField + ' ' + this.consensusResultFilterOperator + " (" + this.consensusResultFilterValue + ")");
                }));
                
                $("#" + this.id + "filterConsensusResultsField").on('change',lang.hitch(this,function(e){
                    $(".chosen").trigger("chosen:updated");
                    this.consensusSelectedField = $("#" + this.id + "filterConsensusResultsField option:selected").text();
                    this.updateConsensusResultValues(this.consensusSelectedField);
                    this.consensusResultFilterField = $("#" + this.id + "filterConsensusResultsField").val();
                    if (this.currentSeverity !== 0 && this.consensusResultFilterField.indexOf("DS") ===0 && this.config.includeBarrierSeverity === true){
                        this.consensusResultFilterField= "s" + this.currentSeverity + this.consensusResultFilterField;
                    }
                    else if (this.currentSeverity === 0 && this.consensusResultFilterField.indexOf("DS") ===0&& this.config.includeBarrierSeverity === true){
                        this.consensusResultFilterField= "s1" + this.consensusResultFilterField;
                    }
		    else{this.consensusResultFilterField =  this.consensusResultFilterField;}
                    
                    $("#" + this.id + "resultsConsensusFilter").val( this.consensusResultFilterField + ' ' + this.consensusResultFilterOperator + " (" + this.consensusResultFilterValue + ")");
                }));
                
                $("#" + this.id + "filterConsensusResultsOperator").on('change',lang.hitch(this,function(e){
                    console.log("filter change");
                    this.consensusResultFilterOperator = $("#" + this.id + "filterConsensusResultsOperator").val();
                    $("#" + this.id + "resultsConsensusFilter").val(this.consensusResultFilterField + ' ' + this.consensusResultFilterOperator + " (" + this.consensusResultFilterValue + ")");
                }));
                $("#" + this.id + "filterConsensusResultsValue").on('change',lang.hitch(this,function(e){
                    this.consensusResultFilterValue = $("#" + this.id + "filterConsensusResultsValue").val();
                    $("#" + this.id + "resultsConsensusFilter").val(this.consensusResultFilterField + ' ' + this.consensusResultFilterOperator + " (" + this.consensusResultFilterValue + ")");
                })); 
                
                $("#"+ this.id + "filterConsensusResultsField").chosen({allow_single_deselect:true, width:"110px"});        
                $("#"+ this.id + "filterConsensusResultsOperator").chosen({allow_single_deselect:true, width:"50px"});
                $("#"+ this.id + "filterConsensusResultsValue").chosen({allow_single_deselect:true, width:"110px"});
                
                //applyFilter to Consensus results
                $("#" + this.id +"applyResultConsensusFilterButton").on('click',lang.hitch(this,function(e){
                    this.consensusCustomFilter = $("#" + this.id + "resultsConsensusFilter").val();         
                    this.map.removeLayer(this.prioritizedBarriers);
                    if (this.consensusSliderFilter !== "" && this.consensusSliderFilter !== undefined){this.consensusFilter = this.consensusSliderFilter + " AND " + this.consensusCustomFilter;}
                    else{this.consensusFilter = this.consensusCustomFilter;}
                    console.log(this.consensusFilter);
                    this.prioritizedBarriers = this.filterMapService(this.consensusFilter, this.prioritizedBarriers, this.config.url); 
                    console.log(this.prioritizedBarriers);
                    this.prioritizedBarriers.setVisibleLayers(this.visibleLayers);
                    setTimeout(lang.hitch(this, function(){
                        this.map.addLayer(this.prioritizedBarriers);
                    },500));        
                    lang.hitch(this, this.refreshIdentify(this.config.url, this.consensusFilter));                     
                }));
                
                //clear filter from consensus results
                $('#' + this.id +'clearResultConsensusFilterButton').on('click',lang.hitch(this,function(e){
                    lang.hitch(this,this.clearConsensusFilterMapService());  
                    //lang.hitch(this, this.filterConsensusMapServiceSlider());       
                }));
            };
            
            //On consensus accordion click add consensus map serv, on custom add GP results
            $('#' + this.id +'customAnalysisResultsAccord').on('click', lang.hitch(this,function(e){
                console.log("accord click");
                if (this.gpResLayer){
                    this.map.removeLayer(this.prioritizedBarriers);
                    this.map.addLayer(this.gpResLayer);
                    this.activateIdentify="consensus";
                    lang.hitch(this, this.refreshIdentify(this.resMapServ));
                    if (this.map.infoWindow){this.map.infoWindow.hide();}
                }
            }));

                            
            //show inputs if yes is selected
            $('#'+ this.id +"customWeightsDiv").hide();
            $("input[name='useConsensusWeights']").on('change',lang.hitch(this,function(){
                $('#'+ this.id +"customWeightsDiv").animate({height:"toggle"}, 500);
                $('#'+ this.id +"consensusButtons").animate({height:"toggle"}, 500);
            }));
            
//            //set up apply weight buttons(alternate instead of toggle button)
//            $.each(this.config.scenarioWeights, lang.hitch(this,function(i, item){
//                var scenWeights = item;
//                var scenName = (Object.keys(item)[0]);
//                buttonName = "apply_" + scenName;
//                console.log(scenName);
//                console.log(scenWeights);
//       
//                $('#' + this.id + buttonName).on('click',lang.hitch(this,function(e){                 
//                    console.log("Click scen " + scenName)
//                    lang.hitch(this, this.applyWeights(scenWeights));
//                }));
//            }));

            //set up toggle buttons to apply consensus weights to custom scenario
             $('input[name="applyScenarioWeights"]').on('change', lang.hitch(this, function(){
                var activeToggle = $('input[name="applyScenarioWeights"]:checked').val();
                var scenName = this.getSubStrAfterLastInstanceOfChar(activeToggle, "_");
                var activeWeightsIndex = this.config.scenarioWeights.findIndex(x =>x[scenName]);
                var scenWeights = this.config.scenarioWeights[activeWeightsIndex];
                lang.hitch(this, this.applyWeights(scenWeights));
             }));


            
            
            
            //set up listener for change to metric weight inputs
            $("input[id^=" +  this.id + 'weightIn]').on('input', lang.hitch(this, function(e){             
                e.currentTarget.value = parseInt(e.currentTarget.value);           
                if (isNaN(parseFloat(e.currentTarget.value)) === true){e.currentTarget.value = 0;}
                lang.hitch(this, this.getCurrentWeights());
            }));
            
            if (this.config.includeCustomAnalysis === true){
                //FILTER BUILDER listener to fill in filter as drop downs are used
                //Only show the filter build inputs if yes is selected
                $('#'+ this.id +"filterBuilderContainer").hide();
                $("input[name='filterBarriers']").on('change',lang.hitch(this,function(){
                    $('#'+ this.id +"filterBuilderContainer").animate({height:"toggle"}, 500);
                    
                    //if "No" is selected reset the values
                    if ($("input[name='filterBarriers']:checked").val() === "no"){
                         $("#" + this.id + "userFilter").val("");
                         $("#" + this.id + "filterBuildField").val('').trigger('chosen:updated');
                         $("#" + this.id + "filterBuildOperator").val('').trigger('chosen:updated');
                         $("#" + this.id + "filterBuildValue").val('').trigger('chosen:updated');
                    }
                }));
                this.filterField = "";
                this.filterOperator ="";
                this.filterValue = "";       
                this.filterFieldList = "";
                for (var i=0; i< this.filters.inputFilters.metricNamesTable.length; i++){
                    this.filterFieldList += "<option value='" + this.filters.inputFilters.metricNamesTable[i].metricGISName + "'>" + this.filters.inputFilters.metricNamesTable[i].metricPrettyName + "</option>";
                }
                $("#" + this.id + "filterBuildField").html(this.filterFieldList);
                this.updateMetricValues = (lang.hitch(this,function (metric){    
                    this.metricValsList = "";
                    for (var i=0; i < this.filters.inputFilters.metricValuesTable[metric].length; i++){
                        if (this.filters.inputFilters.metricValuesTable[metric][i].metricValuePrettyName !== undefined){
                            this.metricValsList += "<option value='" + this.filters.inputFilters.metricValuesTable[metric][i].metricValue + "'>" + this.filters.inputFilters.metricValuesTable[metric][i].metricValuePrettyName + "</option>";
                        }
                        else{
                            this.metricValsList += "<option value='" + this.filters.inputFilters.metricValuesTable[metric][i].metricValue + "'>" + this.filters.inputFilters.metricValuesTable[metric][i].metricValue + "</option>";
                        }
                    }
                    $("#" + this.id + "filterBuildValue").html(this.metricValsList);
                    this.filterValue = $("#" + this.id + "filterBuildValue").val();
                    $(".chosen").trigger("chosen:updated");
                
                    //set operator to = as a default
                    if (this.filterOperator === ""){
                        //$("#" + this.id + "filterBuildOperator").val("=");
                        $('#'+ this.id +"filterBuildOperator").val($('#'+ this.id +"filterBuildOperator option:eq(1)").val());
                        $(".chosen").trigger("chosen:updated");
                        this.filterOperator = $("#" + this.id + "filterBuildOperator").val();
                    }
                    $("#" + this.id + "userFilter").val('"' + this.filterField + '" ' + this.filterOperator + " (" + this.filterValue + ")");
                }));
                $("#" + this.id + "filterBuildField").on('change',lang.hitch(this,function(e){
                    this.selectedMetric = $("#" + this.id + "filterBuildField option:selected").text();
                    this.updateMetricValues(this.selectedMetric);
                    this.filterField = $("#" + this.id + "filterBuildField").val(); 
                    $("#" + this.id + "userFilter").val('"' + this.filterField + '" ' + this.filterOperator + " (" + this.filterValue + ")");
                }));
                $(".chosen").trigger("chosen:updated");
                $("#" + this.id + "filterBuildOperator").on('change',lang.hitch(this,function(e){
                    this.filterOperator = $("#" + this.id + "filterBuildOperator").val();
                    $("#" + this.id + "userFilter").val('"' + this.filterField + '" ' + this.filterOperator + " (" + this.filterValue + ")");
                }));
                $("#" + this.id + "filterBuildValue").on('change',lang.hitch(this,function(e){
                    this.filterValue = $("#" + this.id + "filterBuildValue").val();
                    $("#" + this.id + "userFilter").val('"' + this.filterField + '" ' + this.filterOperator + " (" + this.filterValue + ")");
                }));      
                $("#"+ this.id + "passability").chosen({allow_single_deselect:true, width:"130px"});
                $("#"+ this.id + "filterBuildField").chosen({allow_single_deselect:true, width:"115px"});
                $("#"+ this.id + "filterBuildValue").chosen({allow_single_deselect:true, width:"115px"});
                $("#"+ this.id + "filterBuildOperator").chosen({allow_single_deselect:true, width:"55px"});
                $("#"+ this.id + "summarizeBy").chosen({allow_single_deselect:true, width:"150px"});
                $("#"+ this.id + "summaryStatField").chosen({allow_single_deselect:true, width:"150px"});
                
                // show barriers to remove if yes is selected.  When "no" is selected clear 
                $('#'+ this.id +"barriers2RemoveContainer").hide();
                $("input[name='removeBarriers']").on('change',lang.hitch(this,function(){
                    $('#'+ this.id +"barriers2RemoveContainer").animate({height:"toggle"}, 500);
                    if ($("input[name='removeBarriers']:checked").val() === "no"){
                        if (this.removeFeatureLayer){this.map.removeLayer(this.removeFeatureLayer);}
                        if (this.selectedBarriers){this.map.removeLayer(this.selectedBarriers);}
                        $("#" + this.id + "barriers2Remove").val("");
                        this.barriers2RemoveCount = 0;       
                        this.workingRemoveBarriers = [];
                        this.workingRemoveBarriersString = "";
                        this.activateIdentify="consensus";
                    }    
                }));
                 
                 //Set up select barriers to remove button
                $('input[name="graphicSelectBarriers2Remove"]').on('change', lang.hitch(this, function(){
                    this.selectRemovalBarriers();
                }));
                 
                // show sum stats tabs if yes is selected
                $('#'+ this.id +"sumStatsInputContainer").hide();
                $("input[name='runSumStats']").on('change',lang.hitch(this,function(){
                    $('#'+ this.id +"sumStatsInputContainer").animate({height:"toggle"}, 500);
                }));        
                      
                //apply starting weights 
                if (this.obj.startingUseConsensusWeights === "no"){
                    lang.hitch(this, this.applyWeights(this.obj.startingWeights));
                    $("input[name='useConsensusWeights']").filter('[value=no]').prop('checked', true); 
                    $("#" + this.id +"customWeightsDiv").show();
                }
                else{lang.hitch(this, this.applyWeights(this.config.diadromous));}
                  
                //apply starting passability
                $("#" + this.id + "passability").val(this.obj.startingPassability).trigger("chosen:updated");
                
                //apply starting filter for custom analysis
                if (this.obj.startingFilter !== ""){
                    $("input[name='filterBarriers']").filter('[value=yes]').prop('checked', true);
                    $("#" + this.id + "filterBuilderContainer").show();
                    $("#" + this.id + "userFilter").val(this.obj.startingFilter);
                }
                
                //apply starting barriers to remove
                if (this.obj.startingBarriers2Remove !== ""){
                    this.removingBarriers = true;
                    $("input[name='removeBarriers']").filter('[value=yes]').prop('checked', true);
                    $("#" + this.id + 'barriers2RemoveContainer').show();
                    $("#" + this.id + 'barriers2Remove').val(this.obj.startingBarriers2Remove);
                    lang.hitch(this, this.selectRemovalBarriers());
                }
    
                //apply starting summary stats inputs
                if (this.obj.startingSummarizeBy !== "" ||this.obj.startingSummaryStatField !== ""){
                    $("input[name='runSumStats']").filter('[value=yes]').prop('checked', true);
                    $("#" + this.id + "sumStatsInputContainer").show();
                    $("#" + this.id + "summarizeBy").val(this.obj.startingSummarizeBy).trigger("chosen:updated");    
                    $("#" + this.id + "summaryStatField").val(this.obj.startingSummaryStatField).trigger("chosen:updated");
                }
            
                //Start custom analysis 
                $('#' + this.id +"submitButton").on('click',lang.hitch(this,function(e){
//                    console.log("clicked gp button");                     
                    this.submit();
                }));
                //Canel custom analysis
                $('#' + this.id +"cancelButton").on('click',lang.hitch(this,function(e){
                    console.log("clicked cancel button");                     
                    lang.hitch(this, this.cancelGPServ());
                }));
            
                //download input parameters 
                $('#' + this.id + 'dlInputs').on('click',lang.hitch(this,function(e) { 
                     this.requestObjectPretty = {};
                     for (var key in this.requestObject){        
                         value = this.requestObject[key];         
                         if (this.config.metricNames.hasOwnProperty(value)){
                            //Use the pretty metric name
                            this.requestObjectPretty[key] = this.config.metricNames[value];
                         } 
                         //don't include sort order & log transform in the downloaded inputs
                         else if (key.indexOf("Order") === -1 && key.indexOf("Log") === -1){
                             this.requestObjectPretty[key] = this.requestObject[key];
                         }
                     }
                     this.requestObjectArray = [];
                     this.requestObjectArray.push(this.requestObjectPretty);
                     //add tabs to beautify the JSON
                     this.requestObjectJSON = JSON.stringify(this.requestObjectArray, null, "\t");
                     this.requestObjectJSON = this.requestObjectJSON.replace(/[\u200B-\u200D\uFEFF]/g, "");
                     this.JSONToCSVConvertor(this.requestObjectJSON, this.customResultBaseName +"_Inputs", true);
                }));            
            
                //download buttons
                $('#' + this.id + 'dlCustom').on('click',lang.hitch(this,function(e) {
                    //download zipped file geodatabase result
                    e.preventDefault();
                    window.location.href = this.zippedResultURL;             
                }));        
               $('#' + this.id + 'dlCustomCSV').on('click',lang.hitch(this,function(e) {
                    //download .csv result
                    e.preventDefault();
                    window.location.href = this.excelResultURL;             
                }));    
                
                 $('#' + this.id + 'dlStats').on('click',lang.hitch(this,function(e) {
                    //download summary stats table
                    require(["jquery", "plugins/barrier-prioritization-v3/js/jquery.tabletoCSV"],lang.hitch(this,function($) {
                         $("#" + this.id + "gpSumStatsTable").tableToCSV(this.customResultBaseName + "_SumStats");
                    }));           
                }));   
            }    //END custom analysis                 
            
            

            //apply starting glance zoom state 
            this.regionName = $("#" + this.id + "glanceZoom option:first").val();
            if (this.obj.startingGlanceZoom !== ""){
                $("#" + this.id + "glanceZoom").val(this.obj.startingGlanceZoom).trigger("chosen:updated");
                lang.hitch(this, this.glanceZoom(this.obj.startingGlanceZoom, "no"));
            }
            else{lang.hitch(this, this.glanceZoom(this.regionName));}
            
            //apply starting explore zoom state 
            this.regionName = $("#" + this.id + "exploreZoom option:first").val();
            if (this.obj.startingExploreZoom !== ""){
                $("#" + this.id + "exploreZoom").val(this.obj.startingExploreZoom).trigger("chosen:updated");
                lang.hitch(this, this.exploreZoom(this.obj.startingExploreZoom, "no"));
            }
            else{lang.hitch(this, this.exploreZoom(this.regionName));}            
            
            //apply starting explore sceanrio
            if (this.stateSet === "yes" && this.config.includeMultipleScenarios === true){
                $("#" + this.id + "exploreScenario").val(this.obj.startingExploreScenario).trigger("chosen:updated");
                lang.hitch(this, this.scenarioSelection(this.obj.startingExploreScenario, "no"));
            }
                      
            //add barriers & apply filter if from saved state
            if (this.stateSet === "yes"){
                $('#' + this.id + 'resultsConsensusFilter').val(this.obj.startingConsensusCustomFilter);
                $("#" + this.id + "clickInstructions").show();
                lang.hitch(this, this.filterConsensusMapServiceSlider());

                $("#" + this.id +"consFiltMax").text(4-$('#' + this.id + 'consensusResultFilterSliderTier').slider("values", 0));
                $("#" + this.id +"consFiltMin").text(4-$('#' + this.id + 'consensusResultFilterSliderTier').slider("values", 1));
                      

                this.map.removeLayer(this.prioritizedBarriers);
                this.prioritizedBarriers = this.filterMapService(this.obj.startingConsensusFilter, this.prioritizedBarriers, this.config.url);
                this.prioritizedBarriers.setVisibleLayers(this.visibleLayers);
                setTimeout(lang.hitch(this, function(){
                    if (this.obj.startingTab === "explore"){
                        this.map.addLayer(this.prioritizedBarriers);
                    }
                    else if (this.obj.startingTab === "glance"){
                        this.map.addLayer(this.glanceBarriers);
                    }
                        
                },500));        
                lang.hitch(this, this.refreshIdentify(this.config.url, this.consensusFilter));
                this.filterMapService(this.obj.startingConsensusFilter, this.prioritizedBarriers, this.config.url); 

                //show the state stats expander
                $("#" + this.id + "stateStatsExpander").show();
            }
           
            // //clear all metric weights, filters, barriers to remove, uncheck all options
            // $('#' + this.id +"applyZeroWeight").on('click',lang.hitch(this,function(e){ 
                // lang.hitch(this, this.clearAllInputs());
            // }));
            
            //set all metric weights to zero
            $('#' + this.id +"applyZeroWeight").on('click',lang.hitch(this,function(e){ 
                lang.hitch(this, this.zeroAllWeights());
            }));
            
            //use framework identify if the "Layers" section is open, otherwise use app identify      
            $('#' + this.id + 'mainAccord').on('click',lang.hitch(this,function(e) { 
                setTimeout(lang.hitch(this, this.exploreTabAccordClicks),500); 
            }));

            
            lang.hitch(this, this.metricBarsSetup());
            //download buttons
            $('#' + this.id + 'dlConsensus').on('click',lang.hitch(this,function(e) { 
                //download zipped result
                e.preventDefault();
                window.location.href = this.config.zippedConsensusResultURL; 
                ga('send', 'event', {
                    eventCategory:this.config.analyticsEventTrackingCategory,        
                    eventAction: 'Download consensus GDB', 
                    eventLabel: 'Download consensus GDB' 
                }); 
            }));            
            $('#' + this.id + 'dlConsensusExcel').on('click',lang.hitch(this,function(e) { 
                //download excel result
                e.preventDefault();
                window.location.href = this.config.excelConsensusResultURL;   
                ga('send', 'event', {
                    eventCategory:this.config.analyticsEventTrackingCategory,        
                    eventAction: 'Download consensus Excel', 
                    eventLabel: 'Download consensus Excel' 
                }); 
            }));

            //build checkboxes for additonal layers
            lang.hitch(this, this.setUpAdditionalLayers(this.config.additionalLayers));
            

            //build glance zoom-to chosen
            $("#" + this.id + "glanceZoom").chosen({allow_single_deselect:true, width:"130px"}).change(lang.hitch(this, function(c){
                var v = c.target.value;
                // check for a deselect
                if (v.length === 0){v = "none";}
                //analytics event tracking
                ga('send', 'event', {
                   eventCategory:this.config.analyticsEventTrackingCategory,        
                   eventAction: 'Glance - zoom', 
                   eventLabel: v + ' selected for zoom'
                });   
            	lang.hitch(this, this.glanceZoom(v));
            }));
            
            //build explore zoom-to chosen
            $("#" + this.id + "exploreZoom").chosen({allow_single_deselect:true, width:"130px"}).change(lang.hitch(this, function(c){
                var v = c.target.value;
                // check for a deselect
                if (v.length === 0){v = "none";}
                //analytics event tracking
                ga('send', 'event', {
                   eventCategory:this.config.analyticsEventTrackingCategory,        
                   eventAction: 'Explore - Zoom', 
                   eventLabel: v + ' selected for zoom'
                });   
            	lang.hitch(this, this.exploreZoom());
            }));            
            
            //build scenario selection
            if (this.config.includeMultipleScenarios === true){
                $("#" + this.id + "exploreScenario").chosen({allow_single_deselect:true, width:"130px"}).change(lang.hitch(this, function(c){
                    var v = c.target.value;
                    // check for a deselect
                    if (v.length === 0){v = "none";}

                    //analytics event tracking
                    ga('send', 'event', {
                       eventCategory:this.config.analyticsEventTrackingCategory,        
                       eventAction: 'Consensus scenario selection', 
                       eventLabel: v + ' consensus selected'
                    });   
                    lang.hitch(this, this.scenarioSelection(v, "yes"));
                }));
            }
            
            //build metric selection
            $("#" + this.id + "selectClickMetrics").chosen({width:"80px"})
                .change(function(c){
            });
            $("#" + this.id + "selectClickMetricsContainer").hide();
            $("#" + this.id + "expandSelectMetrics").click(lang.hitch(this, function(){
                $("#" + this.id + "selectClickMetricsContainer").toggle();
                if ($("#" + this.id + "expandSelectMetrics").html()=== 'Edit Metrics <i class="fa fa-gear"></i>'){
                    $("#" + this.id + "expandSelectMetrics").html('Hide Metrics <i class="fa fa-gear"></i>');
                }
                else{$("#" + this.id + "expandSelectMetrics").html('Edit Metrics <i class="fa fa-gear"></i>');}
            }));
            

            
            this.map.on("mouse-move", lang.hitch(this, function(evt){this.getCursorLatLong(evt);}));
            
            //apply the starting metrics for metric bar clicks
            lang.hitch(this, this.updateDefaultMetricBars(this.obj.startingBarMetrics));
            
            //listen for startify radio button change
            $("input[name='stratify']").on('change',lang.hitch(this,function(){
                var v = $("#" + this.id + "exploreScenario").val();
                lang.hitch(this, this.scenarioSelection(v));
            }));  
            

            //apply starting tab
            if(this.obj.startingTab !=="" ){
                lang.hitch(this, this.applyStartingTab(this.obj.startingTab)); 
            }  
        
            
            lang.hitch(this, this.fireResize());
            this.rendered = true;
   
        },    
        
        
        compareValues: function(key, order) {
            // function for sorting an array of objects
            if (order === undefined){order= 'asc';}
            return function(a, b) {
                if(!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
                  // property doesn't exist on either object
                    return 0; 
                }

                const varA = (typeof a[key] === 'string') ? 
                  a[key].toUpperCase() : a[key];
                const varB = (typeof b[key] === 'string') ? 
                  b[key].toUpperCase() : b[key];

                let comparison = 0;
                if (varA > varB) {
                  comparison = 1;
                } else if (varA < varB) {
                  comparison = -1;
                }
                return (
                  (order === 'desc') ? (comparison * -1) : comparison
                );
            };
        },
        
        applyStartingTab: function(tab){
            console.log("applying starting tab");
            var tabs = $("#" + this.id + "mainTabs").children().children();
            $.each(tabs, lang.hitch(this, function(i, v){
                if (v.id === this.id + tab + "Tab"){
                    document.getElementById(v.id).click();
                }
            }));
        },
        
        setupLayers: function(){
            this.glanceBarriers = new ArcGISDynamicMapServiceLayer(this.url);
            this.glanceBarriers.setVisibleLayers([this.config.glanceBarriersLayerID]);
            if (this.obj.stateSet === "no"){
                this.map.addLayer(this.glanceBarriers);
            }

            this.prioritizedBarriers = new ArcGISDynamicMapServiceLayer(this.url);
            this.prioritizedBarriers.setVisibleLayers([this.obj.startingPrioritizedLayerID]);
        },
        

        glanceZoom: function(v, bool){
            console.log(v)
            if (v === undefined){var v = $("#" + this.id + "glanceZoom").val();}
            var zoomExt = new Extent(this.config.zoomTo[v][0][0],this.config.zoomTo[v][0][1], this.config.zoomTo[v][0][2], this.config.zoomTo[v][0][3],
                  new SpatialReference({ wkid:3857 }));
            
            if (this.obj.stateSet === "no" || this.zoomCounter>2){
                this.map.setExtent(zoomExt);
            }
            lang.hitch(this, this.glanceStats(v));
            this.zoomCounter ++;

            
        },
        
        glanceStats: function(v){
            var avgNetRound = this.round(this.config.zoomTo[v][1]["avgNetwork"]*0.000621371, 2);  

            $("#" + this.id + "glanceDams").text(this.config.zoomTo[v][1]["dams"]);    
            $("#" + this.id + "glanceXings").text(this.config.zoomTo[v][1]["crossings"]);
            $("#" + this.id + "glanceNetworks").text(avgNetRound);
            
            //only display the subExtent (e.g. watershed or state outline) being zoomed to
            lang.hitch(this, this.subsetExtent(v));
  

//            //subset out the barriers in the active subextent
//            if (this.glanceExtentCount >=1){
//                //make all barriers semi transparent
//                if (this.glanceBarriers){this.map.removeLayer(this.glanceBarriers);}
//                if (v === this.regionName){
//                    this.glanceBarriers.opacity = 1;
//                    this.map.addLayer(this.glanceBarriers);
//                }   
//                
//                //make a new Feature Layer for subset barriers & apply definition query
//                if(this.subsetBarriers){this.map.removeLayer(this.subsetBarriers);}
//                this.subsetBarriers = new FeatureLayer(this.url +"/" + this.config.glanceBarriersLayerID);
//                this.subsetBarriers.name = "_";
//     
//                console.log(this.subsetBarriers)
//                                
//                if (v !== this.regionName ){
//                    
//                    this.glanceBarriers.opacity = 0.3;
//                    this.map.addLayer(this.glanceBarriers);
//                    this.subsetBarriersLayerDef = this.config.subExtentNameFieldInBarrierLayer + " = '" + v + "'";
//                    this.subsetBarriers.setDefinitionExpression(this.subsetBarriersLayerDef);
//                    
//                    this.map.addLayer(this.subsetBarriers);   
//                    console.log(this.subsetBarriersLayerDef)
//                }
//            }
           
            if (this.glanceExtentCount >=1){
                //make all barriers semi transparent
                if (this.glanceBarriers){this.map.removeLayer(this.glanceBarriers);}
                if (v === this.regionName){
                    this.glanceBarriers.opacity = 1;
                    this.map.addLayer(this.glanceBarriers);
                }   
                

                                
                if (v !== this.regionName ){
                    //make a new Feature Layer for subset barriers & apply definition query
                    if(this.subsetBarriers){this.map.removeLayer(this.subsetBarriers);}
                  
                    this.glanceBarriers.opacity = 0.3;
                    this.map.addLayer(this.glanceBarriers);
                    
                    var layerDefs =[];
                    layerDefs[this.config.hideGlanceBarriersLayerID] = this.config.subExtentNameFieldInBarrierLayer + " = '" + v + "'";
                    this.subsetBarriers = new ArcGISDynamicMapServiceLayer(this.url);
                    this.subsetBarriers.setVisibleLayers([this.config.hideGlanceBarriersLayerID]);
                    this.subsetBarriers.setLayerDefinitions(layerDefs);
                    this.map.addLayer(this.subsetBarriers);   
   
                }
            }
            
            this.glanceExtentCount ++;       
        },

        
        subsetExtent: function(v){
            //only display the subExtent (e.g. watershed or state outline) being zoomed to
            if (this.subExtents){this.map.removeLayer(this.subExtents);}
            if (!this.subExtents || this.subExtents === "off"){
                this.subExtents = new ArcGISDynamicMapServiceLayer(this.url);
            }
            var layerDefs =[];
            layerDefs[this.config.subExtentLayerID] = this.config.subExtentNameField + " = '" + v + "'";                
            this.subExtents.setVisibleLayers([this.config.subExtentLayerID]);
            this.subExtents.setLayerDefinitions(layerDefs);
            this.map.addLayer(this.subExtents);
        },

        
        
        exploreZoom: function(){
            var v = $("#" + this.id + "exploreZoom").val();
            var zoomExt = new Extent(this.config.zoomTo[v][0][0],this.config.zoomTo[v][0][1], this.config.zoomTo[v][0][2], this.config.zoomTo[v][0][3],
                  new SpatialReference({ wkid:3857 }));
            
            //two zoom happen programmatically on render -- glance and explore.
            // in order to not overwrite saved extent from save & share, only
            //fire zoom extent if not coming from saved state or there have already been
            //2 zooms
            if (this.obj.stateSet === "no" || this.zoomCounter>2){
                this.map.setExtent(zoomExt);
            }
            
            if (this.config.includeStratifiedRegions === true){
                lang.hitch(this, this.selectStratification());
            }
            this.zoomCounter ++;
        },
        
        scenarioSelection: function(v, bool){
            var variableString = ("this.config."+v+"MetricBars");
            console.log(variableString);
            var scenarioRadarMetrics = eval(variableString);
            console.log(scenarioRadarMetrics);
            setTimeout(lang.hitch(this, function(){
                lang.hitch(this, this.scenarioNotes(v));
            }, 2000));
            
            //change the radar metrics displayed when sceanrio is changed
//            if (v === "diad"){var scenarioRadarMetrics = this.config.diadromousMetricBars;}
//            if (v === "bkt"){var scenarioRadarMetrics = this.config.brookTroutMetricBars;}
 
            lang.hitch(this, this.updateDefaultMetricBars(scenarioRadarMetrics));
   
            lang.hitch(this, this.selectStratification());
            
            if (this.identifyIterator >0){
               lang.hitch(this, this.metricBars());
            }
//            lang.hitch(this, this.refreshIdentify(this.config.url));
        },

        scenarioNotes: function(scenario){       
            var okButton = "<table class=\"noPrint\" align=\"center\">" +"<tr align=\"center\">" +"<td align=\"center\" colspan=\"2\">" +"<button class=\"button button-primary\" id=\"dialogOK\">OK</button></td></tr></table>" ;
            var scenPrettyName = this.config.scenarioNotes[scenario][0];
            var notes = this.config.scenarioNotes[scenario][1];
            var content = "<h4 style=\"padding:10px\">" +scenPrettyName+"</h4>"+"<hr><p style=\"padding:10px\">" +notes+"</p><hr>"+okButton;
 
            if (this.scenNoteCounter[scenario] === 0){
                this.scenarioDialog.set("content", content);
                this.scenarioDialog.show();
                $("#dialogOK").on("click", lang.hitch(this, function(e){
                    dijit.byId('scenarioDialog').hide(); 
                 }));
                 this.scenNoteCounter[scenario] +=1
            }
        },

        selectStratification: function(){
            var stratExtent = $("#" + this.id + "exploreZoom").val();
            var scenario = $("#" + this.id + "exploreScenario").val();    
            var stratify = $('input[name="stratify"]:checked').val();
 
            
            if (stratify === "stratify-subregion"){
                var primaryLayerKey = stratExtent + "_" + scenario;
                this.activeConsensusLayerID = this.config.stratifiedLayers[primaryLayerKey];
            }
            if (stratify === "stratify-region"){
                var primaryLayerKey = this.config.stratifiedLayers["Region"] + "_" + scenario;
                this.activeConsensusLayerID = this.config.stratifiedLayers[primaryLayerKey];
            }
            console.log("primary layer key = " + primaryLayerKey + " = " + this.config.stratifiedLayers[primaryLayerKey] );
       
            this.subsetExtent(stratExtent);
            this.visibleLayers = [this.activeConsensusLayerID];
            this.prioritizedBarriers.setVisibleLayers(this.visibleLayers);

//            lang.hitch(this, this.clearConsensusFilterMapService());
            
            lang.hitch(this, this.refreshIdentify(this.config.url));

        },

        
        //calculate current metric weights
        metricWeightCalculator: function (gpVals){
            var sumWeights = 0; 
            for (var key in gpVals) {
                if (isNaN(gpVals[key])){
                    console.log("Warning! Must input integers!");
                }
                sumWeights = sumWeights + parseInt(gpVals[key], 10); 
            }
            return sumWeights;
        },
        
        round: function (value, decimals) {
          return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
        },
        
        glanceTabClick: function(){
            console.log("glance tab click");
            if (this.prioritizedBarriers){this.map.removeLayer(this.prioritizedBarriers);}
            if (this.subsetBarriers && this.subsetBarriers!== "off"){this.map.addLayer(this.subsetBarriers);} 
            if (this.subExtents && this.subExtents !== "off"){this.map.addLayer(this.subExtents);}
            if (this.glanceBarriers){this.map.addLayer(this.glanceBarriers);}
            if (this.gpResLayer){this.map.removeLayer(this.gpResLayer);}
            this.activateIdentify = "";
            this.visibleTab = "glance";
            lang.hitch(this, this.refreshIdentify(this.config.url)); 
            lang.hitch(this, this.glanceZoom());
            ga('send', 'event', {
                eventCategory:this.config.analyticsEventTrackingCategory,        
                eventAction: 'Tab click', 
                eventLabel: "Glance tab click" 
            }); 
        },
        
        exploreTabClick: function(){
            console.log("explore tab click");
            lang.hitch(this, this.fireResize());
            if (this.subsetBarriers){this.map.removeLayer(this.subsetBarriers);} 
            if (this.subExtents){this.map.removeLayer(this.subExtents);}
            if (this.glanceBarriers){this.map.removeLayer(this.glanceBarriers);}
            if (this.gpResLayer){this.map.removeLayer(this.gpResLayer);}
            this.map.addLayer(this.prioritizedBarriers);
            this.activateIdentify = "consensus";
            this.visibleTab = "explore";
            lang.hitch(this, this.refreshIdentify(this.config.url)); 
            lang.hitch(this, this.exploreZoom());
            ga('send', 'event', {
                eventCategory:this.config.analyticsEventTrackingCategory,        
                eventAction: 'Tab click', 
                eventLabel: "Explore tab click" 
            });
            if (this.exploreTabCounter === 0){ //show scenario notes the first time on Explore tab
                lang.hitch(this, this.scenarioNotes(this.obj.startingPrioritizedLayerName));
                this.exploreTabCounter += 1;
            }
        },
        
        
        customTabClick: function(){
            lang.hitch(this, this.fireResize());
            if (this.subsetBarriers){this.map.removeLayer(this.subsetBarriers);} 
            if (this.subExtents){this.map.removeLayer(this.subExtents);}
            this.subExtents = "off";
            if (this.glanceBarriers){this.map.removeLayer(this.glanceBarriers);}
            if (this.prioritizedBarriers){this.map.removeLayer(this.prioritizedBarriers);}
            if (this.gpResLayer){this.map.addLayer(this.gpResLayer);}
            this.activateIdentify = "custom";
            this.visibleTab = "custom";
            if (this.resMapServ){
                lang.hitch(this, this.refreshIdentify(this.resMapServ)); 
            }
            ga('send', 'event', {
                eventCategory:this.config.analyticsEventTrackingCategory,        
                eventAction: 'Tab click', 
                eventLabel: "Custom tab click" 
            }); 
        },
        
        exploreTabAccordClicks: function(){
            if ($("#" + this.id +"additionalLayersContainer").is(":visible")===false){
//                console.log("true");
                this.activateIdentify = "consensus";
                lang.hitch(this, this.refreshIdentify(this.config.url));   
            }
            else{                   
//                console.log("false");	                    	
                this.activateIdentify = "framework";
                lang.hitch(this, this.refreshIdentify(this.config.url));              	
            }    
        },
        
        
        fireResize: function(){
            var evt = window.document.createEvent('UIEvents'); 
            evt.initUIEvent('resize', true, false, window, 0); 
            window.dispatchEvent(evt);  
        },
        
        filterMapService: function(filter, mapServLayer, mapServURL){
            var filterParameters = new ImageParameters();
            var layerDefs = [];
            console.log("in function " +filter);

            if (this.config.includeBarrierSeverity === true){
            	console.log(this.currentSeverity);
                layerDefs[this.currentSeverity] = filter;
                filterParameters.layerIds = [this.currentSeverity];
            }
            else{
                filterParameters.layerIds = this.visibleLayers;
                layerDefs[this.visibleLayers] = filter;
                
            }
            
            filterParameters.layerDefinitions = layerDefs;
            filterParameters.layerOption = ImageParameters.LAYER_OPTION_SHOW;
            filterParameters.transparent = true;
            var filteredMapServLayer = new ArcGISDynamicMapServiceLayer(mapServURL, 
                {"imageParameters" : filterParameters});
            return Object(filteredMapServLayer);
        },
        
        clearConsensusFilterMapService: function(){
            this.map.removeLayer(this.prioritizedBarriers);            
            $('#'+ this.id +"resultsConsensusFilter").val(''); 
            $('#'+ this.id +"filterConsensusResultsField").val('option: first').trigger("chosen:updated");
            $('#'+ this.id +"filterConsensusResultsOperator").val('option: first').trigger("chosen:updated");
            $('#'+ this.id +"filterConsensusResultsValue").val('option: first').trigger("chosen:updated");
            this.resetFilterSliders();
            this.consensusFilter = "";
            this.consensusSliderFilter = "";
            this.consensusCustomFilter = "";
            //set these back to original position -- otherwise sAve & share can rememebr them and won't update if changes are made
            this.obj.startingConsensusFilter ="";
            this.obj.startingConsensusCustomFilter = "";
            this.obj.startingConsensusSeverityFilterMax = 5;
            this.obj.startingConsensusSeverityFilterMin = 1;
            this.obj.startingConsensusTierFilterMax = this.config.maxTierVal;
            this.obj.startingConsensusTierFilterMin = 1;
            
            this.prioritizedBarriers = new ArcGISDynamicMapServiceLayer(this.url);
            this.prioritizedBarriers.setVisibleLayers(this.visibleLayers);
           
            setTimeout(lang.hitch(this, function(){
                this.map.addLayer(this.prioritizedBarriers);
            },1000));
            lang.hitch(this, this.refreshIdentify(this.config.url));
          },    
          
        resetFilterSliders: function(){
            $( "#" + this.id + "consensusResultFilterSliderTier" ).slider( "values", 0, 1);
            $( "#" + this.id + "consensusResultFilterSliderTier" ).slider( "values", 1, this.config.maxTierVal);
            $( "#" + this.id + "consensusResultFilterSliderSeverity" ).slider( "values", 0, 1);
            $( "#" + this.id + "consensusResultFilterSliderSeverity" ).slider( "values", 1, 5);
        
            lang.hitch(this, this.displaySliderSelectedValues("#" + this.id + "consensusResultFilterSliderTier",this.consensusResultFilterSliderTierUI));
            lang.hitch(this, this.displaySliderSelectedValues("#" + this.id + "consensusResultFilterSliderSeverity",this.consensusResultFilterSliderSeverityUI));
          },
          
        filterConsensusMapServiceSlider: function(values){
            console.log(values);
            this.consensusTierMaxVal = (this.config.maxTierVal+1)-$('#' + this.id + 'consensusResultFilterSliderTier').slider("values", 0);
            this.consensusTierMinVal = (this.config.maxTierVal+1)-$('#' + this.id + 'consensusResultFilterSliderTier').slider("values", 1);
            this.consensusSeverityMinVal = $('#' + this.id + 'consensusResultFilterSliderSeverity').slider("values", 0);
            this.consensusSeverityMaxVal = $('#' + this.id + 'consensusResultFilterSliderSeverity').slider("values", 1);
            this.consensusSeverityRange = [];
            
            var i=1;
            while (i<=this.consensusSeverityMaxVal){
                if (i>=this.consensusSeverityMinVal){
                    this.consensusSeverityRange.push("'" + this.severityDict[i] + " Barrier" + "'");
                }
                i++;
            }
            console.log(this.consensusSeverityRange);
            this.consensusSeverityRangeStr = this.consensusSeverityRange.toString();
            this.consensusSliderFilter = this.config.resultTier + " >= " + this.consensusTierMinVal + " AND " + this.config.resultTier + " <= " + this.consensusTierMaxVal ;
            if (this.config.includeBarrierSeverity === true){
                this.consensusSliderFilter +=  " AND " + this.config.severityField + " IN (" + this.consensusSeverityRangeStr + ")";
            }
            this.map.removeLayer(this.prioritizedBarriers);
            if (this.consensusCustomFilter !== "" && this.consensusCustomFilter  !== undefined){this.consensusFilter = this.consensusSliderFilter + " AND " + this.consensusCustomFilter;}
            else{this.consensusFilter = this.consensusSliderFilter;}
            
            console.log(this.consensusFilter) ;      
            this.prioritizedBarriers = this.filterMapService(this.consensusFilter, this.prioritizedBarriers, this.config.url);

            this.prioritizedBarriers.setVisibleLayers(this.visibleLayers);
            setTimeout(lang.hitch(this, function(){
                if (this.stateSet === "No" || this.visibleTab === "explore"){
                    this.map.addLayer(this.prioritizedBarriers);
                }
            },500));        
            lang.hitch(this, this.refreshIdentify(this.config.url, this.consensusFilter));

        },

        displaySliderSelectedValues: function(sliderID, ui){
            $(sliderID).next().find('span').each(lang.hitch(this,function(i,v){
                //console.log(ui.values[i]);
                if (sliderID.indexOf('Severity') !== -1){
                    var textVal = this.severityDict[ui.values[i]];
                }
                else{var textVal = (this.config.maxTierVal+1)-ui.values[i];}
                console.log(textVal);
                $(v).html(textVal);
            }));
        },


        selectRemovalBarriers: function() {  
            if($("input[name='graphicSelectBarriers2Remove']:checked").val() === "yes"){this.filterBarr = true;}
               
            if ($("input[name='graphicSelectBarriers2Remove']:checked").val() === "hide"){
                if (this.removeFeatureLayer){
                    this.map.removeLayer(this.removeFeatureLayer);
                    this.map.removeLayer(this.selectedBarriers);
                }
             }
            if ($("input[name='graphicSelectBarriers2Remove']:checked").val() === "show"){
                this.removingBarriers = true;
                this.activateIdentify = "framework";
                lang.hitch(this, this.refreshIdentify());
                if (this.removeFeatureLayer === undefined){
                    console.log("removing barriers");
                    var removeBarrierSymbol = new SimpleMarkerSymbol().setSize(5).setColor(new Color([0,0,0]));
                    this.selectedRemoveBarrierSymbol = new SimpleMarkerSymbol().setSize(10).setColor(new Color([255,0,0]));                                      
                    var renderer = new SimpleRenderer(removeBarrierSymbol);
                    
                    this.removeFeatureLayer = new FeatureLayer(this.config.removeSelectionURL);
                    this.removeFeatureLayer.setRenderer(renderer);
                    this.removeFeatureLayer.MODE_SNAPSHOT;
        
                    if (this.config.includeBarrierSeverity === true){
                        // Set layer definition so barriers to remove layer only shows passability level of barriers being analyzed (e.g. Dams only)
                        this.severityQueryDict = this.config.severityDict;

                        this.severityField = this.severityQueryDict[$('#'+ this.id + 'passability').val()];
                        this.severityQuery = this.severityField +' = 1';
                        console.log(this.severityQuery);
                        this.removeFeatureLayer.setDefinitionExpression(this.severityQuery); 
                        this.removeFeatureLayer.dataAttributes = [this.uniqueID, this.severityField];
                    }
                    else{this.removeFeatureLayer.dataAttributes = [this.uniqueID];}
                    
                    this.selectedBarriers = new GraphicsLayer();
                    
                    //if there's already values in the text box, include the corresponding graphics
                    if ($("#" + this.id + 'barriers2Remove').val() !== ''){
                        lang.hitch(this, this.addSavedBarriersToRemove());
                    }
                    
                    this.removeFeatureLayer.on("click", lang.hitch(this, function(e){
                        this.currID = e.graphic.attributes[this.uniqueID];
                        console.log(this.currID);
                        for (i = 0; i< this.removeFeatureLayer.graphics.length; i++){  
                            if (this.alreadySelBarr2Remove !== undefined && this.alreadySelBarr2Remove.indexOf(this.currID)>=0){
                                console.log(this.currID + "is already selected");
                            }               
                            //the following statement check if each graphic is either the one clicked on or in the list of previously selected 
                            if (this.removeFeatureLayer.graphics[i].attributes[this.uniqueID] === this.currID ){
                                this.barriers2RemoveCount ++;  
                    
                                if (this.barriers2RemoveCount <= 10) {
                                    //Make a graphic copy of the selected point.  Changing the symbology of the existing point worked, but then
                                    //symbology would revert on zoom in/out
                                    var key = this.uniqueID;
                                    var attr = {};
                                    attr[key] = this.removeFeatureLayer.graphics[i].attributes[this.uniqueID];
                                    this.selectedBarrier = new Graphic(this.removeFeatureLayer.graphics[i].geometry, this.selectedRemoveBarrierSymbol, attr );
                                    this.selectedBarriers.add(this.selectedBarrier);
                                     
                                    //if an existing selected graphic is clicked remove it and its UNIQUE_ID from String
                                    this.selectedBarriers.on("click", lang.hitch(this, function(e){
                                        if (this.workingRemoveBarriers.indexOf(e.graphic.attributes[this.uniqueID]) >-1){
                                            this.workingRemoveBarriers.splice(this.workingRemoveBarriers.indexOf(e.graphic.attributes[this.uniqueID]), 1);
                                            this.barriers2RemoveCount --;
                                        }
                                        this.workingRemoveBarriersString = "'" + this.workingRemoveBarriers.join("', '") + "'";
                                        if (this.workingRemoveBarriersString === "''"){this.workingRemoveBarriersString = "";}
                                        $("#" + this.id + 'barriers2Remove').val(this.workingRemoveBarriersString);
                                        this.selectedBarriers.remove(e.graphic);
                                    }));    
                                    this.workingRemoveBarriers.push(this.currID);
                                    this.workingRemoveBarriersString = "'" + this.workingRemoveBarriers.join("', '") + "'";       
                                    $("#" + this.id + 'barriers2Remove').val(this.workingRemoveBarriersString);
                                }
                                else{alert("You may only select 10 barriers");}
                            }
                            else{this.alreadySelBarr2Remove = ""; }
                        }   
                    }));
                }
                  this.map.addLayer(this.removeFeatureLayer);
                  console.log(this.removeFeatureLayer);
                  this.map.addLayer(this.selectedBarriers);
            }
        },
        
        addSavedBarriersToRemove: function(){
            console.log("there's already barriers to remove listed");
            this.alreadySelBarr2RemoveList = $("#" + this.id + 'barriers2Remove').val().split(",");
            this.alreadySelBarr2RemoveQuery = new Query();
            this.alreadySelBarr2RemoveQueryTask = new QueryTask(this.config.removeSelectionURL);//(this.removeFeatureLayer);
            
            this.alreadySelBarr2RemoveQuery.where = this.config.uniqueID + " IN (" + $("#" + this.id + 'barriers2Remove').val() +")";
            
            this.alreadySelBarr2RemoveQuery.returnGeometry = true;
            this.alreadySelBarr2RemoveQuery.outFields = [this.config.uniqueID];
            console.log(this.alreadySelBarr2RemoveQuery);
            console.log(this.alreadySelBarr2RemoveQueryTask);
            this.alreadySelBarr2RemoveQueryTask.execute(this.alreadySelBarr2RemoveQuery,  lang.hitch(this, addQueryResults));
        
            function addQueryResults(results){
                console.log(results);
                for (i = 0; i< results.features.length; i++){  
                     var key = this.uniqueID;
                    var attr2 = {};
                    attr2[key] = results.features[i].attributes[this.config.uniqueID];
                    this.selectedBarrier = new Graphic(results.features[i].geometry, this.selectedRemoveBarrierSymbol, attr2 );
                    this.selectedBarriers.add(this.selectedBarrier);
                    this.barriers2RemoveCount ++; 
                       
                } 
                this.map.addLayer(this.selectedBarriers);
                
                //if an existing selected graphic is clicked remove it and its UNIQUE_ID from String
                this.selectedBarriers.on("click", lang.hitch(this, function(e){
                    if (this.workingRemoveBarriers.indexOf(e.graphic.attributes[this.uniqueID]) >-1){
                        this.workingRemoveBarriers.splice(this.workingRemoveBarriers.indexOf(e.graphic.attributes[this.uniqueID]), 1);
                        this.barriers2RemoveCount --;
                    }
                    this.workingRemoveBarriersString = "'" + this.workingRemoveBarriers.join("', '") + "'";
                    if (this.workingRemoveBarriersString === "''"){this.workingRemoveBarriersString = "";}
                    $("#" + this.id + 'barriers2Remove').val(this.workingRemoveBarriersString);
                    this.selectedBarriers.remove(e.graphic);
                })); 
            }
        },
        
        zeroAllWeights: function(){
            $("input[id^=" + this.id + "weightIn]").each(lang.hitch(this, function(i, v){
                 v.value = 0;
                 $('#' + v.id).removeClass('bp_weighted');            
            }));
            lang.hitch(this, this.getCurrentWeights());
            lang.hitch(this, this.metricWeightCalculator(this.gpVals));
        },
        
        clearAllInputs: function(){
            // $("#" + this.id +"gpStatusReport").html("");
            // $("#" + this.id +"gpStatusReportHead").css('display', 'none');
			// lang.hitch(this, this.zeroAllWeights());
            // $('#'+ this.id +"bp_currWeight").html('0');
            // $('#'+ this.id +"bp_currWeight").css('color', 'red');
            // $('#'+ this.id +"barriers2Remove").val('');
            // $('#'+ this.id +"userFilter").val('');      
            // $('#'+ this.id +"resultsFilter").val(''); 
            // if ($('#'+ this.id +"removeBarriers").is(":checked")){$('#'+ this.id +"removeBarriers").trigger('click');}
            // if ($('#'+ this.id +"runSumStats").is(":checked")){$('#'+ this.id +"runSumStats").trigger('click');}
            // if ($('#'+ this.id +"filterBarriers").is(":checked")){
                // $('#'+ this.id +"filterBarriers").trigger('click');
            // }
            // require(["jquery", "plugins/barrier-prioritization-proto/js/chosen.jquery"],lang.hitch(this,function($) {
                // $('#'+ this.id +"filterBuildField").val('option: first').trigger("chosen:updated");
                // $('#'+ this.id +"filterBuildOperator").val('option: first').trigger("chosen:updated");
                // $('#'+ this.id +"filterBuildValue").val('option: first').trigger("chosen:updated"); 
                // $('#'+ this.id +"filterResultsField").val('option: first').trigger("chosen:updated");
                // $('#'+ this.id +"filterResultsOperator").val('option: first').trigger("chosen:updated");
                // $('#'+ this.id +"filterResultsValue").val('option: first').trigger("chosen:updated");
                // $('#'+ this.id +"passability").val('option: first').trigger("chosen:updated");
                // $('#'+ this.id +"summarizeBy").val('option: first').trigger("chosen:updated");
                // $('#'+ this.id +"summaryStatField").val('option: first').trigger("chosen:updated");
//                 
            // }));                 
            // if (this.removeFeatureLayer != undefined){
                // this.map.removeLayer(this.removeFeatureLayer);
            // }
            // if (this.selectedBarriers != undefined){
                // this.map.removeLayer(this.selectedBarriers);
            // }           
            this.workingRemoveBarriers = [];
            this.workingRemoveBarriersString = "";
            this.barriers2RemoveCount = 0;
            this.removingBarriers = false;

        },
        
       applyWeights: function(weightObj) {
           for (var key in weightObj){
               if (weightObj.hasOwnProperty(key)) {
                   var myWeights = weightObj[key];
               }
           }
           for (var key in myWeights) {
                if (myWeights.hasOwnProperty(key)) {
                    $("#" + this.id + "weightIn-" + key).val(myWeights[key]);
                }
                this.gpVals = {};
                this.weights = $("input[id^=" + this.id + "weightIn]").each(lang.hitch(this, function(i, v){
                    this.gpVals[v.id] = v.value;    
                    if (parseFloat(v.value) > 0){$('#' + v.id).addClass('bp_weighted');}
                    else{$('#' + v.id).removeClass('bp_weighted');}            
                }));
                
                lang.hitch(this, this.getCurrentWeights());
                lang.hitch(this, this.metricWeightCalculator(this.gpVals));
//                this.sumWeights = this.metricWeightCalculator(this.gpVals);      
//                $('#'+ this.id + "bp_currWeight").text(this.sumWeights);
//                if (this.sumWeights !== 100){$('#'+ this.id +"bp_currWeight").css('color', 'red');}
//                if (this.sumWeights === 100){$('#'+ this.id +"bp_currWeight").css('color', 'green');} 
            }
        },
        getCurrentWeights: function(){
                this.gpVals = {};
                this.weights = $("input[id^=" + this.id + "weightIn]").each(lang.hitch(this, function(i, v){
                    if (isNaN(parseFloat(v.value)) === true){v.id = 0;} 
                    if (v.value === ""){v.id = 0;}
                    else{this.gpVals[v.id] = v.value;}      
                    this.gpVals[v.id] = v.value;
                    if (parseFloat(v.value) > 0){$('#' + v.id).addClass('bp_weighted');}
                    else{$('#' + v.id).removeClass('bp_weighted');}                                
                }));
                //console.log(this.gpVals);
                this.sumWeights = this.metricWeightCalculator(this.gpVals);
                //console.log(this.sumWeights);
                $('#'+ this.id + "currWeight").text(this.sumWeights);
                if (this.sumWeights !== 100){
                    $('#'+ this.id +"currWeight").css('color', 'red');
                }
                if (this.sumWeights === 100){
                    $('#'+ this.id +"currWeight").css('color', 'green');
                } 
        },
        
//************GP Service

//prepare and pass the GP request object to gpURL
        submit: function(){
            $("#" +this.id + "cancelButton").show();
            this.getCurrentWeights();
            if (this.sumWeights !== 100){
                alert("Metric weights must sum to 100");
            }
            else{
                 
                 
                //clear old map graphics and results table
                this.map.graphics.clear();
                if (this.selectedBarriers){this.map.removeLayer(this.selectedBarriers);}
                if (this.removeFeatureLayer){this.map.removeLayer(this.removeFeatureLayer);}
                this.tableHTML = "";
                if (this.gpResLayer){this.map.removeLayer(this.gpResLayer);}
               
                this.tableHTML = "<thead> <tr></tr></thead><tbody ></tbody>";
                this.sumStatsTableHTML = "<thead> <tr></tr></thead><tbody ></tbody>";
                if (this.gpIterator >1){                                                               
                     $("#" + this.id + "gpResultTable").trigger("updateAll");  
                }
                if ("#" + this.id + "gpSumStatsTable"){
                    $("#" + this.id + "gpSumStatsTable").trigger("updateAll");
                }
                
                $("#" + this.id + "gpSumStatsTable").html(this.sumStatsTableHTML);
                $("#" + this.id + "gpResultTable").html(this.tableHTML);                
               
               
                this.requestObject = {};                
                if($("input[name='filterBarriers']:checked").val()=== "yes"){this.filterBarr = true;}
                else{this.filterBarr = false;}
            
                //if passability option is an input get it
                if (this.config.includePassabilityOption === true){
                    this.passability = $("#" + this.id + "passability").val();
	                if ($("input[name='takeAverage']:checked").val()=== "yes"){this.takeAverage = true;}
	                else{this.takeAverage = false;}
                }

                if ($("#" + this.id + "userFilter").val() !== ""){
                  this.filter = $("#" + this.id + "userFilter").val();
                }
                else{this.filter = "";}
                if ($("input[name='removeBarriers']:checked").val() === "yes"){this.removeBarr = true;}
                else{this.removeBarr = false;}
                this.removeIDs = $("#" + this.id + "barriers2Remove").val();
                
                if ($("input[name='runSumStats']:checked").val() === "yes"){this.runSumStats = true;}
                else{this.runSumStats = false;} 
                this.summarizeBy = $("#" + this.id + "summarizeBy").val();
                this.sumStatField = $("#" + this.id + "summaryStatField").val();
                
                if ($("input[name='useConsensusWeights']:checked").val() === "no"){this.customWeights = true;}

                
                if ($("#" + this.id + "exportCustomCSV").is(":checked")){
                    this.exportCSV = true;
                }
                else{this.exportCSV = false;}
                
                if (this.config.includePassabilityOption === true){
	                this.requestObject["Passability"] = this.passability;
	                this.requestObject["Take_Average_Value"] = this.takeAverage;
                }
                if (this.config.includeExportCSVOption === true){
	                this.requestObject["ExportCSV"] = this.exportCSV;
                }
                
                this.requestObject["FilterBarriers"] = this.filterBarr;
                this.requestObject["UserFilter"] = this.filter;
                this.requestObject["ModelRemoval"] = this.removeBarr;
                this.requestObject["Barriers_for_Modeled_Removal"] = this.removeIDs;
                this.requestObject["Run_Watershed_Summary_Stats"] = this.runSumStats;
                this.requestObject["Summarize_By"] = this.summarizeBy;
                this.requestObject["Summary_Stat_Field"] = this.sumStatField;
                this.requestObject["Exclude_Features_with_Null_Metric_Values"] = false;
                this.weightIterator = 1;
                $.each(this.gpVals, lang.hitch(this, function(metric, weight){
                    if (weight >0){
                        var mNum = "Metric_" + this.weightIterator;
                        var mWeight = mNum + "_Weight";
                        var mOrder = mNum + "_Order";
                        if (this.config.gpServIncludesLogTransform === true){
                            var mLogTrans = mNum + "_Log_Transform";
                        }
                        var m = metric.replace(this.id + "weightIn-", "");
                        var prettyM = this.config.metricNames[m];
                        this.requestObject[mNum] = m;
                        this.requestObject[mWeight] = weight;
                        this.requestObject[mOrder] = this.config.metricOrder[m];
                        if (this.config.gpServIncludesLogTransform === true){
                            this.requestObject[mLogTrans] = "No";
                        }
                        this.weightIterator ++; 
                        if (this.config.tableResults === true){$("#" + this.id + "gpResultTable tr:first").append("<th>" + prettyM +"</th>");}
                    }
                }));

                console.log(this.requestObject);
                this.statusCallbackIterator = 0;
                
                //Google analytics.  Make a string to indicate what parameters were modified
                if (this.filterBarr === true){var useFilt = "Filter";} else{var useFilt = "";}
                if (this.removeBarr === true){var modRem = "Remove";} else{var modRem = "";}
                if (this.runSumStats === true){var sumStats = "Stats";} else{var sumStats = "";}
                if (this.customWeights === true){var custWeights = "Weights";} else{var custWeights = "";}
                var customParams = useFilt+custWeights+modRem+sumStats;
                ga('send', 'event', {
                    eventCategory:this.config.analyticsEventTrackingCategory,        
                    eventAction: 'Custom analysis submit click', 
                    eventLabel: "Custom analysis: " + customParams 
                 });  
                 
                this.gp.submitJob(this.requestObject, lang.hitch(this, this.completeCallback), lang.hitch(this, this.statusCallback), lang.hitch(this, function(error){
                        alert(error);
                        //re-enable Submit button for subsequent analyses
                        $('#' + this.id +"submitButton").removeClass('bp_submitButtonRunning');
                        $('#' + this.id +"submitButton").prop('disabled', false);

                }));
                
                //disable Submit button so a second analyiss can't be run until the first is finished
                $('#' + this.id +"submitButton").addClass('submitButtonRunning');
                $('#' + this.id +"submitButton").prop('disabled', true);   
                
                //remove any click results
                $("#" + this.id + "customMetricSliderParent").children().remove();
            }
        },

        //GP status
        statusCallback: function(jobInfo) {
            this.status = jobInfo.jobStatus;
            this.jobInfo = jobInfo;
            if(this.status === "esriJobFailed"){
                alert("There was a problem running the analysis.  Please try again. " + this.status);
                //re-enable Submit button for subsequent analyses
                $('#' + this.id +"submitButton").removeClass('bp_submitButtonRunning');
                $('#' + this.id +"submitButton").prop('disabled', false);
            }
            else{
                $("#" + this.id +"gpStatusReportHead").css("display", "block");
            
                if(this.statusCallbackIterator === 0){console.log("Analysis begun!");}
                if (jobInfo.messages.length > 0){
                    this.messages = jobInfo.messages;
                    this.count = this.messages.length;
                    
                    this.index = this.count-1;                  
                    if (this.count>0) {
                        this.message = this.messages[this.index].description;
                    }
                    if ((this.message !== this.updateMessage) && (typeof this.message !== 'undefined')){
                        $("#" + this.id +"gpStatusReport").html(this.message);
                        this.updateMessage = this.message;
                    }
                    if (this.message.indexOf("Succeeded at")===0){
                        $("#" + this.id +"gpStatusReport").html("Analysis completed successfully.  One moment, please...");
                    }
                    if (this.message.indexOf("Result exceeded transfer limit of")===0){
                        $("#" + this.id +"gpStatusReport").html("Analysis completed successfully.  One moment, please...");
                    }
                }
                this.statusCallbackIterator ++;
            }
        },
        
        //GP complete            
        completeCallback: function (jobInfo){
            $("#" + this.id +"gpStatusReport").html("Analysis complete.");
            // Get result as map service -- needed for larger datasets and easy way to get legend
            this.resMapServURLRoot = this.config.gpURL.replace("GPServer/Prioritize", "MapServer/jobs/");
            this.resMapServ =  (this.resMapServURLRoot + jobInfo.jobId);
            this.gpResLayer = new ArcGISDynamicMapServiceLayer(this.resMapServ);
            this.gpResLayer.opacity = 0.8;
            this.map.removeLayer(this.prioritizedBarriers);
            this.map.addLayer(this.gpResLayer);
            console.log("callback complete");
            this.jobInfo = jobInfo;
            // Get result JSON for graphics and linked table
            if (this.runSumStats === true){
                console.log("stats");
                this.gp.getResultData(jobInfo.jobId, this.config.summStatsParamName, lang.hitch(this,this.displayStats));
                console.log("finished stats");
            }

            if (this.config.tableResults === false){
                this.gp.getResultData(jobInfo.jobId, this.config.resultsParamName, lang.hitch(this, this.displayResultMapServ));              
            }
            this.gp.getResultData(jobInfo.jobId, this.config.zippedResultParamName, lang.hitch(this, this.getZippedResultURL));  
            this.gp.getResultData(jobInfo.jobId, this.config.csvResultParamName, lang.hitch(this, this.getCSVResultURL));  
            $("#" + this.id + "customAnalysisResultsAccord" ).trigger( "click" );
   
            this.statusCallbackIterator = 0;
            //Re-enable submit button
            $('#' + this.id +"submitButton").removeClass('submitButtonRunning');
            $('#' + this.id +"submitButton").prop('disabled', false);
     
            $( "#" + this.id + "customResultsPane").trigger("click");
            
        },

        cancelGPServ: function(){
            var cancelURL = this.config.gpURL +"/jobs/" + this.jobInfo.jobId + "/cancel";
            $.get(cancelURL);
           
            //Re-enable submit button
            $('#' + this.id +"submitButton").removeClass('submitButtonRunning');
            $('#' + this.id +"submitButton").prop('disabled', false);
        },

        getZippedResultURL: function (result, messages){
            console.log(result.value.url);
            this.zippedResultURL = result.value.url; //this is accessed when the download button is pressed
        
            this.customResultBaseName = (result.value.url.substr(result.value.url.lastIndexOf('/') + 1)).replace(".zip", "");
            console.log(this.customResultBaseName);
            
            $('#' + this.id + 'downloadCustomContainer').show();
            if (this.requestObject.Run_Watershed_Summary_Stats===true){
                $('#' + this.id + 'dlStats').show(); 
            }
            else{$('#' + this.id + 'dlStats').hide(); }    
        },
        
        getCSVResultURL: function (result, messages){
            console.log(result.value.url);
            this.excelResultURL = result.value.url; //this is accessed when the download button is pressed
            if (this.requestObject.ExportCSV===true){
                $('#' + this.id + 'dlCustomCSV').show(); 
            }
            else{$('#' + this.id + 'dlCustomCSV').hide(); }
        },

        //Display GP Result Map Service  
        displayResultMapServ: function (result, messages){
            this.gpIterator ++;
            //set identify to GP service
            this.activateIdentify = "custom";
            lang.hitch(this, this.refreshIdentify(this.resMapServ)); 
            
            //Still working on this - zoom to subset of barriers that are prioritized
//            var layerDef=[];
//            layerDef[0]= "Tier Is Not Null";
//            this.gpResLayer.setLayerDefinitions(layerDef);
//            console.log(this.gpResLayer)
//            var ext = this.gpResLayer.initialExtent;
//            console.log(ext)
//            this.map.setExtent = ext;
//            layerDef[0]= "1=1";
//            this.gpResLayer.setLayerDefinitions(layerDef);
            
        },


        //Display Summary Stats table
        displayStats:  function(result, messages){
            console.log(result)
            console.log("in display stats");
            $("#" + this.id + "gpSumStatsTable tr:first").append("<th>" + this.summarizeBy + "</th>");
                $("#" + this.id + "gpSumStatsTable tr:first").append("<th># Barriers</th>");
                $("#" + this.id + "gpSumStatsTable tr:first").append("<th>Max " + this.sumStatField + "</th>");
                $("#" + this.id + "gpSumStatsTable tr:first").append("<th>Mean " + this.sumStatField + "</th>");
                $("#" + this.id + "gpSumStatsTable tr:first").append("<th>Min " + this.sumStatField + "</th>");
                $("#" + this.id + "gpSumStatsTable tr:first").append("<th>Std Dev " + this.sumStatField +  "</th>");
                var d = [];
                var dStr = "";
                var dStr2 = "";
                this.sumStatsFeatures = result.value.features; 
                console.log(this.sumStatsFeatures) ;    
                for (var f=0, fl=this.sumStatsFeatures.length; f<fl; f++) {
                    this.feature = this.sumStatsFeatures[f];
                    var row = this.feature.attributes;
                    d.push("<tr>");
                    d.push("<td>" + row.CASEFIELD + "</td>");
                    d.push("<td>" + row.COUNT + "</td>");
                    d.push("<td>" + row.MAX + "</td>");
                    d.push("<td>" + row.MEAN + "</td>");
                    d.push("<td>" + row.MIN + "</td>");
                    d.push("<td>" + row.STD + "</td>");
                    d.push("</tr>");
                }
                dStr = d.toString();
                dStr2 = dStr.replace(/,/g, "");
                $("#" + this.id + "gpSumStatsTable > tbody:last-child").append(dStr2); 
                console.log(dStr2);
                $('#' + this.id + 'gpSumStatsTableDivContainer').show();    
            },


//End GP Service        

        selectorTextReplace: function(selector, replace, replaceWith){
            $(selector).html($(selector).html().replace(replace, replaceWith));
        },
        
        grepFilterbyArray: function(list, filterArr) {
            return $.grep(list, function(obj) {
                
                return $.inArray(obj.axis, filterArr) !== -1;
            });
        },
        
        metricBarsSetup: function(){
            $("#"+ this.id + "selectClickMetrics").chosen({allow_single_deselect:true, width:"250px"});
            this.radarAttrs = "";
            for (var key in this.config.metricShortNames) {
                if (this.config.metricShortNames.hasOwnProperty(key)) {
                    //console.log(key + " -> " + this.config.metricShortNames[key]);
                    this.radarAttrs += "<option value='" + key + "'>" + this.config.metricShortNames[key] + "</option>";
                }
            }
            $("#" + this.id + "selectClickMetrics").html(this.radarAttrs);
            
            //this sets the starting radar metrics to be shown via config array
            lang.hitch(this, this.updateDefaultMetricBars(this.obj.startingBarMetrics));
            
            this.startingBarMetrics = []; //array from obj 
            for (var i=0; i<this.obj.startingBarMetrics.length; i++){ 
                this.startingBarMetrics.push(this.obj.startingBarMetrics[i]);
            };
            
//            //This set the weighted anadromous metrics to show in the radar by default 
//            $.each(this.config.diadromous, lang.hitch(this, function(k, v){
//                console
//                if (v >0){
//                    this.startingBarMetrics.push("PR" + k);
//                }
//             }));
                         
            $("#" + this.id + "selectClickMetrics").val(this.currentRadarMetrics).trigger('chosen:updated');
            //listen for changes to selected radar metrics
            $("#"+ this.id + "selectClickMetrics").on("change", lang.hitch(this, function(){
                if (this.identifyIterator >0){
                    lang.hitch(this, this.metricBars());
                    
                    //analytics event tracking
                    ga('send', 'event', {
                       eventCategory:this.config.analyticsEventTrackingCategory,        
                       eventAction: 'changing metric bars', 
                       eventLabel: 'changing metric bars'
                    });
                }
            }));
        },
        
        
        updateDefaultMetricBars: function(defaultBarMetrics) { 
            if(defaultBarMetrics){
                this.currentBarMetrics = []; //array from config 
                for (var i=0; i< defaultBarMetrics.length; i++){ 
                    this.currentBarMetrics.push(defaultBarMetrics[i]);
                };
                $("#" + this.id + "selectClickMetrics").val(this.currentBarMetrics).trigger('chosen:updated');
            }
        },
        
        metricBars: function(){
            //only show those attributes selected by user - take the text labels, not the values since the radar
            //axis use the labels
            var userFilterArray = $("#" + this.id + "selectClickMetrics").val();
//            console.log(userFilterArray);
            this.userFilterArray=[];
            for (var i=0; i< userFilterArray.length; i++){
                this.userFilterArray.push(this.config.metricShortNames[userFilterArray[i]]);
            }
            this.metricBarDataFiltered = this.grepFilterbyArray(this.metricBarData, this.userFilterArray);
            this.temp = [];
            this.temp.push(this.metricBarDataFiltered);
            this.metricBarDataFiltered = this.temp;
            
            $("#" + this.id + "metricSliderParent").children().remove();
            $("#" + this.id + "metricSliderGoodBad").show();

            this.metricBarDataFilteredSorted = this.metricBarDataFiltered[0].sort(this.compareValues('axis'));
  
            $.each(this.metricBarDataFilteredSorted, lang.hitch(this, function(i, v){
//                console.log(v.axis);
//                console.log(v.coreName);
//                console.log(v.unit);
//                console.log(v.value);
//                console.log(v.valDisp);
     
                //Make jQuery objects for HTML to be inserted.  If appended as HTML string, can't access to set slider values
                var sliderVal = Math.round(v.value*100);
                var sliderHead = $('<a href="plugins/barrier-prioritization-v3/images/' + v.coreName + '.pdf" onClick=' + "'" + 'return windowPopup(this, "' + v.coreName +'", "width=660,height=590,scrollbars=yes")' + "'" + 'class="bp_exploreMetricBarLink"><p class="bp_exploreMetricBarP"></p></a>').text(v.axis + ": " + v.valDisp);
                var sliderContainer = $('<div class="slider-container bp_exploreMetricBarContainer" id="#' +  this.id + v.coreName +'Container" style="width:250px;"></div>');        
                var slider = $('<div class="slider metricSlider" id="#' +  this.id + v.coreName +'"></div>');
               
               //Append the jquery objects
                if (isNaN(v.value) === false){
                    $("#" + this.id + "metricSliderParent").append(sliderHead).append(sliderContainer);
                    $(sliderContainer).append(slider);            
                    $(".metricSlider").slider({min: 0, max: 100, range: false});
                    $(".metricSlider").each(function(){
                        this.style.setProperty("background-color", "white" , "important");
                    });

                    $(slider).slider("value", sliderVal);
                    $(slider).slider({disabled: true});
                    $("#" + this.id + "metricSliderGoodBad").show();
                }
                else{
                    $("#" + this.id + "metricSliderParent").append(sliderHead).append("<br>");
                    $("#" + this.id + "metricSliderGoodBad").hide();
                }
           }));
        },        

        customMetricBars: function(){
            $("#" + this.id + "customMetricSliderParent").children().remove();
            $("#" + this.id + "customMetricSliderGoodBad").show();
         
            var temp = [];
            temp.push(this.customMetricBarData);
            this.customMetricBarData = temp;

            this.customMetricBarDataSorted = this.customMetricBarData[0].sort(this.compareValues('axis'));
        
            $.each(this.customMetricBarDataSorted, lang.hitch(this, function(i, v){
//                console.log(v.axis);
//                console.log(v.coreName);
//                console.log(v.unit);
//                console.log(v.value);
//                console.log(v.valDisp);
     
                //Make jQuery objects for HTML to be inserted.  If appended as HTML string, can't access to set slider values
                var sliderVal = Math.round(v.value*100);
                var sliderHead = $('<a href="plugins/barrier-prioritization-v3/images/' + v.coreName + '.pdf" onClick=' + "'" + 'return windowPopup(this, "' + v.coreName +'", "width=660,height=590,scrollbars=yes" )' + "'" + 'class="bp_exploreMetricBarLink"><p class="bp_exploreMetricBarP"></p></a>').text(v.axis + ": " + v.valDisp); 
                var sliderContainer = $('<div class="slider-container bp_exploreMetricBarContainer" id="#custom' +  this.id + v.coreName +'Container" style="width:250px;"></div>');        
                var slider = $('<div class="slider metricSlider" id="#custom' +  this.id + v.coreName +'"></div>');
                
               //Append the jquery objects
                if (isNaN(v.value) === false){
                    $("#" + this.id + "customMetricSliderParent").append(sliderHead).append(sliderContainer);
                    $(sliderContainer).append(slider);            
                    $(".metricSlider").slider({min: 0, max: 100, range: false});
                    $(".metricSlider").each(function(){
                        this.style.setProperty("background-color", "white" , "important");
                    });

                    $(slider).slider("value", sliderVal);
                    $(slider).slider({disabled: true});
                    $("#" + this.id + "customMetricSliderGoodBad").show();
                }
                else{
                    $("#" + this.id + "customMetricSliderParent").append(sliderHead).append("<br>");
                    $("#" + this.id + "customMetricSliderGoodBad").hide();
                }
                $("#" + this.id + "customClickMetricsContainer").show();
           }));
        },
        

        setUpAdditionalLayers: function(addlLayers){
            $.each(addlLayers, lang.hitch(this, function(k, v){
                // console.log("layer Name: " + k + " layerID: " + v[0] +" URL: " + v[1]);
                var addlLayerVis = ("addlLayerVis" + v[0]);
                this[addlLayerVis] = [];
                var addlLayer = ("addlLayer" + v[0]);
                this[addlLayer] = new ArcGISDynamicMapServiceLayer(v[1]);        
                this[addlLayer].on("load", lang.hitch(this, function (){
                    this[addlLayer].minscale = this[addlLayer].layerInfos[v[2]].minScale;
                    this[addlLayer].maxscale = this[addlLayer].layerInfos[v[2]].maxScale;
                }));
                $("#" + this.id + "toggleBarriers").append(
                    '<div class="layer">' +
                        '<label class="form-component">' +
                            '<input type="checkbox" data-layer="' + v[0] + '" id="' + this.id + v[0]+  '">' +
                            '<div class="check"></div>' +
                            '<span class="form-text">' + k + '</span>' +
                        '</label>' +
                        '<span class="fa fa-info-circle info bp_infoIcon" title="' + v[3] + '"></span>' +
                        '<div class="bp_transparency-control" data-layer="' + v[0] + '" id="' + this.id + v[0] +  'transp" data-opacity="100">' +
                            '<span class="bp_transparency-header">Transparency</span>' +
                            '<div class="bp_transparency-label"><span class="value">100%</span></div>' +
                            '<div class="bp_transparency-slider">' +
                                '<div class="slider"></div>' +
                            '</div>' +
                        '</div>' +
                    '</div>'
                );
                
                //if the layer is not visible eat this scale (from map service) disbale the checkbox
                this.map.on("extent-change", lang.hitch(this, function(){
                    var addlLayer = ("addlLayer" + v[0]);
                    if ((this[addlLayer].minscale !== 0 && this.map.getScale() >this[addlLayer].minscale) ||( this[addlLayer].maxscale !== 0 && this.map.getScale() < this[addlLayer].maxscale)){
                        $("#" + this.id + v[0]).attr("disabled", true);
                    }
                    else{$("#" + this.id + v[0]).attr("disabled", false);}
                    
                }));
                
                //toggle layers on and off
                $("#" + this.id + v[0]).on('click', lang.hitch(this, function(e) {
                    var ischecked = $("#" + e.target.id).is(':checked');
                    if (ischecked) {
                        var addlLayer = ("addlLayer" + v[0]);
                        this[addlLayerVis].push(v[2]);
                        this[addlLayer].setVisibleLayers(this[addlLayerVis]);
                        this.map.addLayer(this[addlLayer]);
                        $("#" + e.target.id + "transp").show();
                    
                    } 
                    else {
                        var addlLayer = ("addlLayer" + v[0]);
                        this.map.removeLayer(this[addlLayer]);
                        var index = this[addlLayerVis].indexOf(v[2]);
                        if (index >= 0) {
                          this[addlLayerVis].splice( index, 1 );
                        }
                        this[addlLayer].setVisibleLayers(this[addlLayerVis]);
                        $("#" + e.target.id + "transp").hide();
                    }
                }));
                
                //turn on by default if config says to
                if (v[4] === "on" || this.obj.startingAdditionalLayers[v[0]] === "on"){$("#" + this.id + v[0]).trigger("click");}
            }));
            
            //set up barrier default toggle.  This is done separately, since it is not listed in the additional layers of the config file
            $("#" + this.id + "barriers").on('click', lang.hitch(this, function(e) {
                var ischecked = $("#"+ this.id + "barriers").is(':checked');
                if (ischecked) {
                    this.map.addLayer(this.prioritizedBarriers);
                    $("#" + this.id + "barrierstransp").show();
                }
                else{
                    this.map.removeLayer(this.prioritizedBarriers);
                    $("#" + this.id + "barrierstransp").hide();
                }
            }));
            
            //hide all the transparency sliders by default
            $(".bp_transparency-control").hide();
            //except for the barriers which are turned on by default
            $("#" + this.id + "barrierstransp").show();
            
            //transparency
            $(".bp_transparency-slider .slider").slider({
                    min: 0,
                    max: 100,
                    step: 1,
                    value: [100],
                    range: false,
                    slide: lang.hitch(this, function(e, ui) { 
                        var control = $(e.target).parents('.bp_transparency-control');
                        console.log(control[0].id);
                        if (control[0].id.indexOf("barriers") !== -1){
                            this.prioritizedBarriers.setOpacity(ui.value / 100);
                        }
                        else{
                            control.attr('data-opacity', ui.value);
                             var layer = "addlLayer" + control.first().data('layer');
                            control.find('.value').html(ui.value + '%');
                            this[layer].setOpacity(ui.value / 100);
                        }
                        $('.info').tooltip({
                        });
                    })
            });
            $('.bp_transparency-label').on('mousedown', lang.hitch(this, function(e) {
                var control = $(e.target).parent('.bp_transparency-control').toggleClass('open');
                var dataLayer = control.attr('data-layer');
                if (control.hasClass('open')) {
                    $('body').on('click.tranSlider', lang.hitch(this, function(e) {
                        if ($(e.target).parents('.bp_transparency-control[data-layer=' + dataLayer + ']').length || ($(e.target).hasClass('bp_transparency-control') && $(e.target).attr('data-layer') === dataLayer)) {
                            // Do nothing
                        } else {
                            control.removeClass('open');
                            $('body').off('click.tranSlider');
                        }
                    }));
                }
            }));
        },
        
        getCursorLatLong: function(evt){
        	var mp = webMercatorUtils.webMercatorToGeographic(evt.mapPoint);
        	$("#" + this.id + "latLongText").text("Cursor Lat= " + mp.y.toFixed(4) + " Long=" + mp.x.toFixed(4));
        },
        
        JSONToCSVConvertor: function(JSONData, ReportTitle, ShowLabel) {
            //taken from http://jsfiddle.net/hybrid13i/JXrwM/
            //If JSONData is not an object then JSON.parse will parse the JSON string in an Object
            var arrData = typeof JSONData !== 'object' ? JSON.parse(JSONData) : JSONData;
            var CSV = '';    
            //Set Report title in first row or line         
            CSV += ReportTitle + '\r\n' + JSONData;    
            //Generate a file name
            var fileName = "";
            //this will remove the blank-spaces from the title and replace it with an underscore
            fileName += ReportTitle.replace(/ /g,"_");   
            
            //Initialize file format you want csv or xls
            var uri = 'data:text/csv;charset=utf-8,' + escape(CSV);
            
            // Now the little tricky part.
            // you can use either>> window.open(uri);
            // but this will not work in some browsers
            // or you will not get the correct file extension    
            
            //this trick will generate a temp <a /> tag
            var link = document.createElement("a");    
            link.href = uri;
            
            //set the visibility hidden so it will not effect on your web-layout
            link.style = "visibility:hidden";
            link.download = fileName + ".csv";
            
            //this part will append the anchor tag and remove it after automatic click
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },                   
        
        refreshIdentify: function(layerURL, layerDef) { 
//            console.log("identify active = " +this.activateIdentify);
            
            this.idLayerURL = layerURL;
            if (this.activateIdentify === ""){
                this.allowIdentifyWhenActive = false;
                dojo.disconnect(this.identifyClick);
            }
            if (this.activateIdentify === "framework"){ 
            	//this is the generic framework identify
            	this.allowIdentifyWhenActive = true;
                dojo.disconnect(this.identifyClick);
            }
            if (this.activateIdentify === "consensus" || this.activateIdentify === "custom"){
//                console.log("visible layers = " + this.visibleLayers);
            	//this is the custom identify w/ radar
            	this.allowIdentifyWhenActive = false;
                dojo.disconnect(this.identifyClick);
                    
                //Identify functionality...     
                this.identifyRes = new IdentifyTask(layerURL);
                this.identifyParams = new IdentifyParameters();
                this.identifyParams.tolerance = 6;
                this.identifyParams.returnGeometry = true;
                if (layerURL === this.config.url){
                    var visLayer = this.visibleLayers;
//                    console.log("querying layer # " + visLayer);
                }
                else{var visLayer = 0;}
          
                this.identifyParams.layerIds = visLayer;
                this.identifyParams.layerDefinitions=[];
                if (layerURL === this.config.url && this.config.includeBarrierSeverity === true){
                    var idLayer = parseInt(this.currentSeverity);
                }
                else{var idLayer = 0;}
//                console.log(idLayer);
//                console.log(visLayer);
                if (layerDef !== undefined){
                    this.identifyParams.layerDefinitions[idLayer] = layerDef;
//                    console.log("layer def= " + this.identifyParams.layerDefinitions);
                }
                else if (this.consensusFilter !== []){
                    this.identifyParams.layerDefinitions[idLayer] = this.consensusFilter;
                }
                else{this.identifyParams.layerDefinitions = [];}
                this.identifyParams.layerOption = IdentifyParameters.LAYER_OPTION_VISIBLE;
                this.identifyParams.width = this.map.width;
                this.identifyParams.height = this.map.height;
                
                this.identifyClick = dojo.connect(this.map, "onClick", lang.hitch(this, function(evt){this.doIdentify(evt);}));    
            }    

            
        },
            
        doIdentify: function(evt){
//            console.log(evt);
            if (this.activateIdentify === "consensus" && this.firstIdentify === 0){
                $("#" + this.id + "clickMetricsContainer").show();
                $("#" + this.id + "clickInstructions").hide();
            }
            if (this.activateIdentify === "consensus" || this.activateIdentify === "custom"){
//                console.log("LayerDefs = " + this.identifyParams.layerDefinitions);
//                console.log("Layer IDs = " + this.identifyParams.layerIds);
                this.identifyRes = new IdentifyTask(this.idLayerURL);
                this.identifyParams.geometry = evt.mapPoint;
                this.identifyParams.mapExtent = this.map.extent;
                this.identifyIterator = 0; 
                              
                this.identifyRes        
                    .execute(this.identifyParams)
                    .addCallback(lang.hitch(this, function (response) {
//                        console.log(response);
                        if (this.identifyIterator ===0 && response[0]){
//                            console.log(response[0].feature);
                            if (this.activateIdentify === "consensus"){
                                lang.hitch(this, this.displayIDResult(response[0].feature, this.identifyParams.geometry));
                            }
                            if (this.activateIdentify === "custom"){
                                lang.hitch(this, this.displayCustomIDResult(response[0].feature, this.identifyParams.geometry));
                            }
                        }
                        this.identifyIterator ++;    
                        this.idContent = "";
                }));
            } 
            this.firstIdentify ++;
        },
        
        displayIDResult: function(idResult, point){
            this.idContent="";
            this.metricBarData =[];
            this.allClickData = {}; //build an object to get the all real values.
            console.log(this.allClickData);
            $.each(idResult.attributes, lang.hitch(this, function(k, v){ 
                this.allClickData[k] = v; 
            }));
            //Set click result header info
            $("#" + this.id + "clickBarrierName").text(this.allClickData[this.config.barrierNameField]);
            $("#" + this.id + "clickBarrierID").text(this.allClickData[this.config.uniqueID]);
            $("#" + this.id + "clickBarrierType").text(this.allClickData[this.config.barrierTypeField]);
            

            //add links to photos
            var photoHtml ="";
            var siteID = this.allClickData[this.config.uniqueID];
            $("#" + this.id + "clickBarrierPhotos").children().remove();
            if (this.photoNames[siteID] !== undefined){
                $.each(this.photoNames[siteID], lang.hitch(this, function(k, v){
                    var link = this.config.photoURLRoot + v;
                    var photoRoot = v.replace(".JPG", "").replace(".jpg", "");
                    var dispName= v.replace(".JPG", "").replace(".jpg", "").replace("_", "").replace("-", "").replace(this.allClickData[this.config.uniqueID], "");
                    photoHtml = photoHtml + '<a href="'+link+ '" onClick=' + "'" + 'return windowPopup(this, "' +photoRoot+ '", "width=660,height=590,scrollbars=yes")'+ "'" + ' class="bp_exploreMetricBarLink">' + dispName+ '</a>';
           
                }));
                $("#" + this.id + "clickBarrierPhotos").append(photoHtml);
            }
            else{$("#" + this.id + "clickBarrierPhotos").append("<p>No photos available</p>");}
            
            if (this.allClickData[this.config.resultTier] !== "Null"){
                $("#" + this.id + "notPrioritizedHeader").hide();
                $("#" + this.id + "clickBarrierTier").text(this.allClickData[this.config.resultTier]);
            }
            else{
                $("#" + this.id + "notPrioritizedHeader").show();
                

                if (this.allClickData[this.config.barrierPassabilityField] < this.config.consensusFilterPassabilityThreshold){
                    var Text = "This barrier was not prioritized because one of the following is true: the barrier doesn't meet the filtering criteria of the sceanrio or because one or more input datasets does not cover the extent of this barrier. This barrier can be prioritized by running a custom analysis that doesn't use a filter and or any of the metrics below that have 'Null' values for this barrier.";
                    $("#" + this.id + "notPrioritizedText").text(Text);
                    $("#" + this.id + "clickBarrierTier").text("Not Prioritized - Missings Metric(s)");
                }
                else{
                    var Text = "This barrier was not prioritized. It was initially classified as a 'Potential Barrier', without a significant outlet perch.  Further work to refine its passability indicate that it is not likely to be a velocity barrier because it has a Froude number less than 1 (eqautes to Passability >0.66). See the 'Documentation' pane below for more information on how this passability score was calculated. This barrier can be prioritized by running a custom analysis that does not include a filter on Passability.";
                    $("#" + this.id + "notPrioritizedText").text(Text);
                    $("#" + this.id + "clickBarrierTier").text("Not Prioritized - Presumed Passable");
                }
            }
            $("#" + this.id + "clickBarrierPassability").text(this.round(this.allClickData[this.config.barrierPassabilityField],2));
            
            $.each(this.allClickData, lang.hitch(this, function(k, v){ 
                if (this.idLayerURL === this.config.url && this.config.includeBarrierSeverity === true){
                    var metricSev = "s"+String(this.currentSeverity);
                }
                else{var metricSev = k;}

                if (k.indexOf(metricSev)===0){
                    if (this.idLayerURL === this.config.url && this.config.includeBarrierSeverity === true){
                           var basename = k.replace(metricSev, "");
                    }
                    else{var basename = k;}
                    if ($.inArray(basename, this.config.idBlacklist) === -1){
                        //don't show indivudal metric values if consensus (average result)
                        if (this.currentSeverity !== "0"){

                            if (this.config.includeBarrierSeverity === true){
                                var PRsev = "PR" + String(this.currentSeverity);
                            }
                            else{var PRsev = "PR";}
                            basename = k.replace(PRsev, "");
                            if (k.indexOf(PRsev)===0){ 
                                
                                //convert meter results to miles, round if a number, take value as is if not a number, use yes or no if unit is yes/no
                                var realVal = this.allClickData[basename];
                                if (this.config.metricUnits[basename] === "yes/no"){
                                    if (parseInt(realVal) === 0){var vDisplay ="No";}
                                    if (parseInt(realVal) === 1){var vDisplay ="Yes";}
                                }
                                else if (this.config.metricMetersToMiles.indexOf(basename)!== -1){
                                    var vDisplay = String(this.round(realVal * 0.000621371, 2)) + " miles";
                                }
                                else if(isNaN(parseFloat(realVal)) === false){var vDisplay = this.round(realVal, 2);}
                                else{var vDisplay = realVal;}

                                if (k.indexOf(PRsev) === 0){
                                    this.radarItem = {};
                                    this.radarItem["axis"] = this.config.metricShortNames[basename];
                                    this.radarItem["coreName"] = basename;
                                    this.radarItem["unit"]= this.config.metricUnits[basename];
                                    this.radarItem["value"] =parseFloat(v)/100;
                                    this.radarItem["valDisp"]=vDisplay;
                                    this.metricBarData.push(this.radarItem);
                                }   

//                                //HTML for identify popup -- loop through and include all fields except those in plugin-config blakclist
//                                if (this.config.metricNames[basename] !== undefined){
//                                    this.idContent = this.idContent + "<b>" + this.config.metricNames[basename] + "</b> : " + vDisplay + "<hr>";
//                                }
//                                if (this.config.idWhiteList[basename] !== undefined){
//                                    this.idContent = this.idContent + "<b>" + basename+ "</b> : " + vDisplay + "<hr>";
//                                }

                            }
                        }
                    }
                }    
           
            }));
                
            if (this.idLayerURL === this.config.url && this.config.includeBarrierSeverity === true){
                var tierName = "Tier" + String(this.currentSeverity);
            }
            else {var tierName = this.config.resultTier;}
    
            if (this.allClickData[this.config.barrierTypeField] ==="Crossing"){
                if (this.config.includeSurveyPageLink ===true ){
                    var survDate = this.allClickData["SurveyDate"];
                    var survID = this.allClickData["surveyID"];
                    var survLink =this.config.xingSurveyURL + survID;

                    if (this.allClickData[this.config.barrierTypeField] === "Crossing" && survID !== ""){
                            //var type = 'Crossing (Surveyed <a href="' +survLink +'" target="_blank"><strong>' + survDate + '</strong>)</a>';
                            var type = 'Crossing (<a href="' +survLink +'" target="_blank"><strong>'+"View Survey Data"+'</strong>)</a>';
                    }
                    if (this.allClickData[this.config.barrierTypeField]==="Crossing" && (survID === "" || survDate === "Null")){
                            var type = 'Crossing (No Survey Available)';
                    }
                }
                else{var type = "Crossing";}
            }
            else if(this.allClickData[this.config.barrierTypeField] ==="Dam"){
                if (this.config.includeFERC === true){
                    if (this.allClickData[this.config.barrierTypeField]==="Dam" &&  this.allClickData["FERC"] !== ""){
                            var type= 'Dam (FERC prj: ' + this.allClickData["FERC"] + ') + <br>NOI Exp Date: ' + this.allClickData["FERC_NOIExpDate"];
                    }
                    if (this.allClickData[this.config.barrierTypeField]==="Dam" &&  this.allClickData["FERC"] ===  ""){
                            var type= 'Dam (No known FERC prj)';
                    }
                }
                else {var type="Dam";}
            }
            else{var type="Natural Barrier";}
            
            if (this.config.includeBarrierSeverity === true && this.currentSeverity !== 0){
                var radarSeverityDisplay = this.config.severityNumDict[this.currentSeverity] + " Iteration";
            }
            if (this.config.includeBarrierSeverity === true && this.currentSeverity ===0){
                var radarSeverityDisplay = "Insignificant Barrier Iteration";
            }
            this.clickHeader = "Name: " + this.allClickData[this.config.barrierNameField] +
            "<br/>ID: " + this.allClickData[this.config.uniqueID] +
            "<br/>Type: " + type;
            
            
            //show this barrier's severity
            if (this.config.includeBarrierSeverity === true){
                this.clickHeader += "<br/>" + this.allClickData[this.config.severityField];
            }           
            
            if (this.config.includeFactSheets === true){
            	this.clickHeader += "<br/><a target='_blank' href='plugins/barrier-prioritization-v3/factSheets/" + this.allClickData[this.config.uniqueID] + ".pdf'>Fact Sheet</a>";
            }
                        
            //show iteration being used if including barrier severity, it's not the average value, and it's not a GP service result
            if (this.config.includeBarrierSeverity === true && this.currentSeverity !== "0" && this.idLayerURL === this.config.url){    
                this.clickHeader = this.clickHeader + "<br/>All values for " + radarSeverityDisplay;
            }

            lang.hitch(this, this.metricBars());

            //if using radar plot, don't show metric values in popup
            this.idContent = this.clickHeader;

            this.identJSON = {
                title: "${" + this.uniqueID+ "} = Tier ${" + tierName +"}",
                content: this.idContent
            };
            this.popupInfoTemplate = new InfoTemplate(this.identJSON);
            idResult.setInfoTemplate(this.popupInfoTemplate);    
            this.map.infoWindow.show(point);            
            this.map.infoWindow.resize(300,400); //switching to framework identify can cause this popup to resize wrong.  So be explicit    
            this.map.infoWindow.setFeatures([idResult]);
        },            

        getSubStrAfterLastInstanceOfChar: function(str, char) {
            return str.split(char).pop();
        },
        
        
        displayCustomIDResult: function(idResult, point){
            console.log("custom display result");
            $("#" + this.id + "customClickInstructions").hide();
            this.customMetricBarData =[];
            this.customAllClickData = {}; //build an object to get the all real values.  Used in RadarChart.js to make tooltip labels
            this.customMetricsUsed = [];
            $.each(idResult.attributes, lang.hitch(this, function(k, v){ 
                this.customAllClickData[k] = v; 
            }));
            console.log(this.customAllClickData);
            //Set click result header info
            $("#" + this.id + "customClickBarrierName").text(this.customAllClickData[this.config.barrierNameField]);
            $("#" + this.id + "customClickBarrierID").text(this.customAllClickData[this.config.uniqueID]);
            $("#" + this.id + "customClickBarrierType").text(this.customAllClickData[this.config.barrierTypeField]);
            
            //add links to photos
            var photoHtml ="";
            var siteID = this.customAllClickData[this.config.uniqueID];
            $("#" + this.id + "customClickBarrierPhotos").children().remove();
            if (this.photoNames[siteID] !== undefined){
                $.each(this.photoNames[siteID], lang.hitch(this, function(k, v){
                    var link = this.config.photoURLRoot + v;
                    var photoRoot = v.replace(".JPG", "").replace(".jpg", "");
                    var dispName= v.replace(".JPG", "").replace(".jpg", "").replace("_", "").replace("-", "").replace(this.customAllClickData[this.config.uniqueID], "");
                    photoHtml = photoHtml + '<a href="'+link+ '" onClick=' + "'" + 'return windowPopup(this, "' +photoRoot+ '", "width=660,height=590,scrollbars=yes")'+ "'" + ' class="bp_exploreMetricBarLink">' + dispName+ '</a>';
           
                }));
                $("#" + this.id + "customClickBarrierPhotos").append(photoHtml);
            }        
            else{$("#" + this.id + "customClickBarrierPhotos").append("<p>No photos available</p>");}
            
            
            if (this.customAllClickData[this.config.resultTier] !== "Null"){
                $("#" + this.id + "customNotPrioritizedHeader").hide();
                $("#" + this.id + "customClickBarrierTier").text(this.customAllClickData[this.config.resultTier]);
            }
            else{
                $("#" + this.id + "customNotPrioritizedHeader").show();     
                $("#" + this.id + "customClickBarrierTier").text("Not Prioritized - User Filter");
            }
            $("#" + this.id + "customClickBarrierPassability").text(this.round(this.customAllClickData[this.config.barrierPassabilityField],2));
            
            $.each(this.customAllClickData, lang.hitch(this, function(k, v){ 
                if (this.idLayerURL === this.config.url && this.config.includeBarrierSeverity === true){
                    var metricSev = "s"+String(this.currentSeverity);
                }
                else{var metricSev = k;}

                if (k.indexOf(metricSev)===0){
                    if (this.idLayerURL === this.config.url && this.config.includeBarrierSeverity === true){
                           var basename = k.replace(metricSev, "");
                    }
                    else{var basename = k;}
                    
                    if ($.inArray(basename, this.config.idBlacklist) === -1){
                        //don't show indivudal metric values if consensus (average result)
                        if (this.currentSeverity !== "0"){

                            if (this.config.includeBarrierSeverity === true){
                                var PRsev = "PR" + String(this.currentSeverity);
                            }
                            else{var PRsev = "PR";}
                            basename = k.replace(PRsev, "");
                            if (k.indexOf(PRsev) === 0){
                                this.customMetricsUsed.push(basename);
                                //convert meter results to miles, round if a number, take value as is if not a number, use yes or no if unit is yes/no
                                var realVal = this.customAllClickData[basename];
                                if (this.config.metricUnits[basename] === "yes/no"){
                                    if (parseInt(realVal) === 0){var vDisplay ="No";}
                                    if (parseInt(realVal) === 1){var vDisplay ="Yes";}
                                }
                                else if (this.config.metricMetersToMiles.indexOf(basename)!== -1){
                                    var vDisplay = String(this.round(realVal * 0.000621371, 2)) + " miles";
                                }
                                else if(isNaN(parseFloat(realVal)) === false){var vDisplay = this.round(realVal, 2);}
                                else{var vDisplay = realVal;}

                                if (k.indexOf(PRsev) === 0){
                                    this.customBarItem = {};
                                    this.customBarItem["axis"] = this.config.metricShortNames[basename];
                                    this.customBarItem["coreName"] = basename;
                                    this.customBarItem["unit"]= this.config.metricUnits[basename];
                                    this.customBarItem["value"] =parseFloat(v)/100;
                                    this.customBarItem["valDisp"]=vDisplay;
                                    this.customMetricBarData.push(this.customBarItem);
                                }   

                            }
                        }
                    }
                }    
           
            }));        
            
            
            
            var tierName = this.config.resultTier;
            this.customClickHeader = "Name: " + this.customAllClickData[this.config.barrierNameField] +
            "<br/>ID: " + this.customAllClickData[this.config.uniqueID] +
            "<br/>Type: " + this.customAllClickData[this.config.barrierTypeField];
            
            this.identJSON = {
                title: "${" + this.uniqueID+ "} = Tier ${" + tierName +"}",
                content: this.customClickHeader
            };
            this.popupInfoTemplate = new InfoTemplate(this.identJSON);
            idResult.setInfoTemplate(this.popupInfoTemplate);    
            this.map.infoWindow.show(point);            
            this.map.infoWindow.resize(300,400); //switching to framework identify can cause this popup to resize wrong.  So be explicit    
            this.map.infoWindow.setFeatures([idResult]);
            lang.hitch(this, this.customMetricBars());
        }
        
        //End of functions...
    });
});