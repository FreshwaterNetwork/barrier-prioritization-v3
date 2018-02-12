// Pull in your favorite version of jquery 
require({ 
    packages: [{ name: "jquery", location: "http://ajax.googleapis.com/ajax/libs/jquery/2.1.0/", main: "jquery.min" }] 
});
// Bring in dojo and javascript api classes as well as varObject.json, js files, and content.html
define([
    "dojo/_base/declare", "dojo/_base/lang", "dojo/_base/Color",  "dojo/_base/array", "framework/PluginBase", "dijit/layout/ContentPane", "dojo/dom", 
    "dojo/dom-style", "dojo/dom-geometry", "dojo/text!./obj.json", "dojo/text!./html/content.html", './js/esriapi', './js/clicks', './js/RadarChart',
    './js/d3.min', 'dojo/text!./config.json', 'dojo/text!./filters.json', "esri/layers/ImageParameters", "esri/layers/FeatureLayer", "esri/layers/GraphicsLayer",
     "esri/layers/ArcGISDynamicMapServiceLayer",  "esri/graphic", "esri/symbols/SimpleMarkerSymbol", "esri/tasks/Geoprocessor", "esri/tasks/IdentifyTask", "esri/tasks/IdentifyParameters", "esri/InfoTemplate",
     "esri/renderers/SimpleRenderer", "esri/geometry/Extent", "esri/geometry/webMercatorUtils", "esri/SpatialReference","esri/tasks/query", "esri/tasks/QueryTask"
],
function (     declare, lang, Color, arrayUtils, PluginBase, ContentPane, dom, domStyle, domGeom, obj, content, Esriapi, Clicks, RadarChart, d3, config, 
    filters, ImageParameters, FeatureLayer, GraphicsLayer, ArcGISDynamicMapServiceLayer, Graphic, SimpleMarkerSymbol, Geoprocessor, IdentifyTask, 
    IdentifyParameters, InfoTemplate, SimpleRenderer, Extent, webMercatorUtils, SpatialReference, Query, QueryTask) {
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
            this.url = this.config.url;
            this.layerDefs = [0];
            this.gp = new esri.tasks.Geoprocessor(this.config.gpURL);
            this.gp.setUpdateDelay(200); //status check in milliseconds;
            
        },
        // Called after initialize at plugin startup (why the tests for undefined). Also called after deactivate when user closes app by clicking X. 
        hibernate: function () {
            if (this.appDiv !== undefined){
                this.dynamicLayer.setVisibleLayers([-1]);
            }
            this.open = "no";
            
            
        },
        // Called after hibernate at app startup. Calls the render function which builds the plugins elements and functions.   
        activate: function () {
            //$('#' + this.id + 'mainAccord').css("display", "none");
            if (this.rendered === false) {
                this.rendered = true;                            
                this.render();
                $(this.printButton).hide();
            }else{
                
                $('#' + this.id).parent().parent().css('display', 'flex');
                this.clicks.updateAccord(this);
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
                //accordions
                if ( $('#' + this.id + 'mainAccord').is(":visible") ){
                    this.obj.accordVisible = 'mainAccord';
                    this.obj.accordHidden = 'infoAccord';
                }else{
                    this.obj.accordVisible = 'infoAccord';
                    this.obj.accordHidden = 'mainAccord';
                }    
                this.obj.accordActive = $('#' + this.id + this.obj.accordVisible).accordion( "option", "active" );
                // main button text
                this.obj.buttonText = $('#' + this.id + 'getHelpBtn').html();
                //extent
                this.obj.extent = this.map.geographicExtent;
                this.obj.stateSet = "yes";    
                
                //get the current map layers
//                if (this.dynamicLayer.visible === true){this.obj.startingMapLayers =true;}
                this.obj.startingMapLayers =true;
                $.each(this.obj.startingAdditionalLayers, lang.hitch(this, function(key,value ) {
                    if ($("#" + this.id + key).is(':checked')){
                        this.obj.startingAdditionalLayers[key]="on";
                    }
                }));
                
                //Get starting barrier severity
                this.obj.startingDisplayBarrierSeverity = $("#" + this.id + "selectSeverity").val();

                //Get the state/region zoomed into & sceanrio
                this.obj.startingZoomState = $("#" + this.id + "zoomState").val();
                this.obj.startingScenario = $("#" + this.id + "scenario").val();
                
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
                    
                }
                
                if (document.getElementById(this.id + 'consensusResultFilterSliderTier')) {
                    this.obj.startingConsensusTierFilterMin =$('#' + this.id + 'consensusResultFilterSliderTier').slider("values", 0);
                    this.obj.startingConsensusTierFilterMax =$('#' + this.id + 'consensusResultFilterSliderTier').slider("values", 1);
                    this.obj.startingUseConsensusFilter = true;
                    if (this.consensusCustomFilter !=="" && this.consensusCustomFilter  !== undefined){this.obj.startingConsensusFilter = this.consensusSliderFilter + " AND " + this.consensusCustomFilter;}
                    else{this.obj.startingConsensusFilter = this.consensusSliderFilter;}
                }
                if (document.getElementById(this.id + 'consensusResultFilterSliderSeverity')) {
                    this.obj.startingConsensusSeverityFilterMin =$('#' + this.id + 'consensusResultFilterSliderSeverity').slider("values", 0);
                    this.obj.startingConsensusSeverityFilterMax =$('#' + this.id + 'consensusResultFilterSliderSeverity').slider("values", 1);
                    this.obj.startingUseConsensusFilter = true;
                    if (this.consensusCustomFilter !== "" && this.consensusCustomFilter  !== undefined){this.obj.startingConsensusFilter = this.consensusSliderFilter + " AND " + this.consensusCustomFilter;}
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
                this.obj.startingVisibleLayers = this.visibleLayers;
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
            //this.oid = -1;
            //$('.basemap-selector').trigger('change', 3);
            this.mapScale  = this.map.getScale();
            // BRING IN OTHER JS FILES
            this.esriapi = new Esriapi();
            this.clicks = new Clicks();
            this.RadarChart = new RadarChart();
            
            
            // ADD HTML TO APP
            // Define Content Pane as HTML parent        
            this.appDiv = new ContentPane({style:'padding:0; color:#000; flex:1; display:flex; flex-direction:column;}'});
            this.id = this.appDiv.id;
            dom.byId(this.container).appendChild(this.appDiv.domNode);    
            $('#' + this.id).parent().addClass('flexColumn');
            $('#' + this.id).addClass('accord');
            if (this.obj.stateSet === "no"){
                $('#' + this.id).parent().parent().css('display', 'flex');
            }        
            // Get html from content.html, prepend appDiv.id to html element id's, and add to appDiv
            var idUpdate = content.replace(/for="/g, 'for="' + this.id).replace(/id="/g, 'id="' + this.id);   
            $('#' + this.id).html(idUpdate);
            

            //make overflow hidden on content pane to avoid having two vertical scrollbars
            $("#" + this.id).css({overflow: "hidden"});

            // Click listeners
            this.clicks.appSetup(this);
            // Create ESRI objects and event listeners    
            this.esriapi.esriApiFunctions(this);
            
            
            //set varaibles
            this.severityDict = this.config.severitySliderDict;
            this.activateIdentify = true;
            this.uniqueID = this.config.uniqueID;
            this.barriers2RemoveCount = 0;       
            this.workingRemoveBarriers = [];
            this.workingRemoveBarriersString = "";
            this.useRadar = true;
            this.visibleLayers = this.obj.startingVisibleLayers;
            this.selectSeverityCounter = 0;
            this.refreshBarChartCounter = 0;
            this.activateIdentify = true;
            lang.hitch(this, this.refreshIdentify(this.url));

            
               
            //hide elements until they're needed 
            $('#' + this.id + 'gpSumStatsTableDivContainer').hide(); 
            $('#' + this.id + 'downloadCustomContainer').hide();                 
            $("#" + this.id +"consensusRadarBlockExpander").hide();
            $("#" + this.id +"radarMetricChangerOpenExpander").hide();
            $("#" + this.id +"consensusResultFiltersExpander").hide();
            if (this.config.includeBarrierSeverity === false){
                $("#" + this.id +"stateStatsExpander").show();
            }
            else{$("#" + this.id +"stateStatsExpander").hide();}
            
            //$("#" + this.id +"additionalLayersExpander").hide();
            $('#' + this.id + 'clickInstructions').hide();  
            $("#" + this.id + "consensusRadarNoUse").hide();
            
            if (this.config.includeBarrierSeverity === false){this.currentSeverity = "";}

            if (this.config.includeExploreConsensus === true){
                //Consensus Tier Slider
                $('#' + this.id + 'consensusResultFilterSliderTier').slider({
                    range:true, 
                    min:1, 
                    max:20, 
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
                        if (this.filters.resultFilters.resultValuesTable[field][i].resultValuePrettyName != undefined){
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
                        if (this.consensusResultFilterOperator == ""){
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
                    if (this.currentSeverity !=0 && this.consensusResultFilterField.startsWith("DS") && this.config.includeBarrierSeverity===true){
                        this.consensusResultFilterField= "s" + this.currentSeverity + this.consensusResultFilterField;
                    }
                    else if (this.currentSeverity ==0 && this.consensusResultFilterField.startsWith("DS")&& this.config.includeBarrierSeverity===true){
                        this.consensusResultFilterField= "s1" + this.consensusResultFilterField;
                    }
					else{this.consensusResultFilterField=  this.consensusResultFilterField;}
                    
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
                    this.map.removeLayer(this.dynamicLayer);
                    if (this.consensusSliderFilter != "" && this.consensusSliderFilter != undefined){this.consensusFilter = this.consensusSliderFilter + " AND " + this.consensusCustomFilter;}
                    else{this.consensusFilter = this.consensusCustomFilter;}
                    console.log(this.consensusFilter);
                    this.dynamicLayer = this.filterMapService(this.consensusFilter, this.dynamicLayer, this.config.url); 
                    console.log(this.dynamicLayer);
                    this.dynamicLayer.setVisibleLayers(this.visibleLayers);
                    setTimeout(lang.hitch(this, function(){
                        this.map.addLayer(this.dynamicLayer);
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
                    this.map.removeLayer(this.dynamicLayer);
                    this.map.addLayer(this.gpResLayer);
                    this.useRadar = false;
                    this.activateIdentify=true;
                    lang.hitch(this, this.refreshIdentify(this.resMapServ));
                    if (this.map.infoWindow){this.map.infoWindow.hide();}
                }
            }));
            $('#' + this.id +'exploreConsensusAccord').on('click', lang.hitch(this,function(e){
                if (this.gpResLayer){
                    this.map.removeLayer(this.gpResLayer);
                }
                if (this.dynamicLayer.visible === true){this.map.removeLayer(this.dynamicLayer);}
                this.map.addLayer(this.dynamicLayer);
                this.useRadar = true;
                this.activateIdentify=true;
                lang.hitch(this, this.refreshIdentify(this.config.url));
                if (this.config.includeBarrierSeverity === true){
                    $('#' + this.id +'selectSeverity').trigger("updated");
                }
                if (this.map.infoWindow){this.map.infoWindow.hide();}
            }));
            
            
            //set up metric weight tabs
            jQuery('.tabs .tab-links a').on('click', function(e)  {
                tabIDprefix = this.id.split("tab")[0];
                mapSide = tabIDprefix.replace("weightIn", "");
                var currentAttrValue = mapSide + jQuery(this).attr('href');
                currentAttrValue = "#" + currentAttrValue;
                // Show/Hide Tabs
                jQuery('.tabs ' + currentAttrValue).show().siblings().hide();
                // Change/remove current tab to active
                jQuery(this).parent('li').addClass('active').siblings().removeClass('active'); 
                e.preventDefault();
            });
                
            //show inputs if yes is selected
            $('#'+ this.id +"customWeightsDiv").hide();
            $("input[name='useConsensusWeights']").on('change',lang.hitch(this,function(){
                $('#'+ this.id +"customWeightsDiv").animate({height:"toggle"}, 500);
                //if "consensus" is checked, fill in consensus values
                if ($("input[name='useConsensusWeights']:checked").val()=="yes"){
                    lang.hitch(this, this.applyWeights(this.obj.startingWeights));
                    lang.hitch(this, this.getCurrentWeights());
                }
                if ($("input[name='useConsensusWeights']:checked").val()=="no"){
                    lang.hitch(this, this.applyWeights(this.config.diadromous));
                }
            }));
            
            //set up listener for change to metric weight inputs
            $("input[id^=" +  this.id + 'weightIn]').on('input', lang.hitch(this, function(e){             
                e.currentTarget.value = parseInt(e.currentTarget.value);           
                if (isNaN(parseFloat(e.currentTarget.value)) == true){e.currentTarget.value = 0;}
                lang.hitch(this, this.getCurrentWeights());
            }));
            
            if (this.config.includeCustomAnalysis == true){
                //FILTER BUILDER listener to fill in filter as drop downs are used
                //Only show the filter build inputs if yes is selected
                $('#'+ this.id +"filterBuilderContainer").hide();
                $("input[name='filterBarriers']").on('change',lang.hitch(this,function(){
                    $('#'+ this.id +"filterBuilderContainer").animate({height:"toggle"}, 500);
                    
                    //if "No" is selected reset the values
                    if ($("input[name='filterBarriers']:checked").val()=="no"){
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
                        if (this.filters.inputFilters.metricValuesTable[metric][i].metricValuePrettyName !=undefined){
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
                    if (this.filterOperator == ""){
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
                $("#"+ this.id + "filterBuildField").chosen({allow_single_deselect:true, width:"125px"});
                $("#"+ this.id + "filterBuildValue").chosen({allow_single_deselect:true, width:"125px"});
                $("#"+ this.id + "filterBuildOperator").chosen({allow_single_deselect:true, width:"55px"});
                $("#"+ this.id + "summarizeBy").chosen({allow_single_deselect:true, width:"150px"});
                $("#"+ this.id + "summaryStatField").chosen({allow_single_deselect:true, width:"150px"});
                
                // show barriers to remove if yes is selected.  When "no" is selected clear 
                $('#'+ this.id +"barriers2RemoveContainer").hide();
                $("input[name='removeBarriers']").on('change',lang.hitch(this,function(){
                    $('#'+ this.id +"barriers2RemoveContainer").animate({height:"toggle"}, 500);
                    if ($("input[name='removeBarriers']:checked").val()=="no"){
                        if (this.removeFeatureLayer){this.map.removeLayer(this.removeFeatureLayer);}
                        if (this.selectedBarriers){this.map.removeLayer(this.selectedBarriers);}
                        $("#" + this.id + "barriers2Remove").val("");
                        this.barriers2RemoveCount = 0;       
                        this.workingRemoveBarriers = [];
                        this.workingRemoveBarriersString = "";
                        this.activateIdentify=true;
                    }    
                }));
                 
                 //Set up select barriers to remove button
                $('input[name="graphicSelectBarriers2Remove"]').on('change', lang.hitch(this, function(){

                    this.selectRemovalBarriers();
                }));
                 
                 
                // //show sum stats tabs if yes is selected
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
                if (this.obj.startingFilter != ""){
                    $("input[name='filterBarriers']").filter('[value=yes]').prop('checked', true);
                    $("#" + this.id + "filterBuilderContainer").show();
                    $("#" + this.id + "userFilter").val(this.obj.startingFilter);
                }
                
                //apply starting barriers to remove
                if (this.obj.startingBarriers2Remove != ""){
                    this.removingBarriers = true;
                    $("input[name='removeBarriers']").filter('[value=yes]').prop('checked', true);
                    $("#" + this.id + 'barriers2RemoveContainer').show();
                    $("#" + this.id + 'barriers2Remove').val(this.obj.startingBarriers2Remove);
                    lang.hitch(this, this.selectRemovalBarriers());
                }
    
                //apply starting summary stats inputs
                if (this.obj.startingSummarizeBy != "" ||this.obj.startingSummaryStatField != ""){
                    $("input[name='runSumStats']").filter('[value=yes]').prop('checked', true);
                    $("#" + this.id + "sumStatsInputContainer").show();
                    $("#" + this.id + "summarizeBy").val(this.obj.startingSummarizeBy).trigger("chosen:updated");    
                    $("#" + this.id + "summaryStatField").val(this.obj.startingSummaryStatField).trigger("chosen:updated");
                }
            
                //Start custom analysis 
                $('#' + this.id +"submitButton").on('click',lang.hitch(this,function(e){
                    console.log("clicked gp button");            
                                        
                    this.submit();
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
                         else if (key.indexOf("Order") == -1 && key.indexOf("Log") == -1){
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
                    require(["jquery", "plugins/barrier-prioritization-proto2/js/jquery.tabletoCSV"],lang.hitch(this,function($) {
                         $("#" + this.id + "gpSumStatsTable").tableToCSV(this.customResultBaseName + "_SumStats");
                    }));           
                }));   
            }    //END custom analysis                 
            
            
            //apply starting barrier severity
            if (this.obj.startingDisplayBarrierSeverity !== ""){
                lang.hitch(this, this.selectBarrSeverity(this.obj.startingDisplayBarrierSeverity))
            }
                    
            //apply starting zoom state 
            if (this.obj.startingZoomState !== ""){
                $("#" + this.id + "zoomState").val(this.obj.startingZoomState).trigger("chosen:updated");
                lang.hitch(this, this.zoomToStates(this.obj.startingZoomState, "no"));
            }
            else{lang.hitch(this, this.zoomToStates("Region", "no"));}
            
            //apply starting sceanrio
            if (this.stateSet === "yes" && this.config.includeMultipleScenarios === true){
                $("#" + this.id + "scenario").val(this.obj.startingScenario).trigger("chosen:updated");
                lang.hitch(this, this.scenarioSelection(this.obj.startingScenario, "no"));
            }
                      
            //add barriers & apply filter if from saved state
            if (this.stateSet === "yes"){
                    $('#' + this.id + 'resultsConsensusFilter').val(this.obj.startingConsensusCustomFilter);
                    $("#" + this.id + "clickInstructions").show();
                    lang.hitch(this, this.filterConsensusMapServiceSlider());

                    $("#" + this.id +"consFiltMax").text(21-$('#' + this.id + 'consensusResultFilterSliderTier').slider("values", 0));
                    $("#" + this.id +"consFiltMin").text(21-$('#' + this.id + 'consensusResultFilterSliderTier').slider("values", 1));
                    $("#" + this.id +"consSevMin").text(this.severityDict[$('#' + this.id + 'consensusResultFilterSliderSeverity').slider("values", 0)]);
                    $("#" + this.id +"consSevMax").text(this.severityDict[$('#' + this.id + 'consensusResultFilterSliderSeverity').slider("values", 1)]);                    

                    this.map.removeLayer(this.dynamicLayer);
                    this.dynamicLayer = this.filterMapService(this.obj.startingConsensusFilter, this.dynamicLayer, this.config.url);
                    this.dynamicLayer.setVisibleLayers(this.visibleLayers);
                    setTimeout(lang.hitch(this, function(){
                        this.map.addLayer(this.dynamicLayer);
                    },500));        
                    lang.hitch(this, this.refreshIdentify(this.config.url, this.consensusFilter));
                    this.filterMapService(this.obj.startingConsensusFilter, this.dynamicLayer, this.config.url); 
                    
                    //set the severity dropdown
                    if (this.config.includeBarrierSeverity == true){
                        $("#" + this.id + "selectSeverity").val(parseInt(this.visibleLayers)).trigger('chosen:updated');
                    }
                   
                   
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
            
            //Set up the +/- expanders 
            this.expandContainers = ["consensusRadarBlock", "barrierSeverity", "customFilter","consensusResultFilters", "customMetric", 
            "barrierRemoval", "sumStats", "additionalLayers", "stateStats", "severitySelection", "takeAverage"];
            //Hide all expansion containers & set cursor to pointer        
            for (var i=0; i<this.expandContainers.length; i++){
                $("#" + this.id + this.expandContainers[i] + "Container").hide();
                $("#" + this.id + "-" +  this.expandContainers[i] + "Info").hide();
                $("#" + this.id + this.expandContainers[i] + "Expander").css( 'cursor', 'pointer' );
                if (this.config.includeBarrierSeverity === true){
                    if (this.expandContainers[i] == "severitySelection"){
                        $("#" + this.id + this.expandContainers[i] + "Container").animate({height:"toggle"}, 500);
                        $("#" + this.id + "-severitySelectionInfo").show();
                        
                    }
                }
                else{
                    if (this.expandContainers[i] === "stateStats"){
                        $("#" + this.id + this.expandContainers[i] + "Container").animate({height:"toggle"}, 500);
                        $("#" + this.id + "-stateStatsInfo").show();
                        
                    }
                }
            }
            //on expander click loop through all expanders -- open this one and close all the others.  Also switch +/- 
            $('.bp_expander').on("click", lang.hitch(this, function(e){
                //show the assess a barrier expander if it's hidden, which it is by default
                if ($("#" + this.id +"severitySelectionExpander").is(":visible") === false){$("#" + this.id +"severitySelectionExpander").animate({height:"toggle"}, 500);}
                var expander = e.currentTarget.id;
                var container = e.currentTarget.id.replace("Expander", "Container");
                for (var i=0; i<this.expandContainers.length; i++){
                                                            
                    if (this.id + this.expandContainers[i]+"Expander" === expander && $("#" + this.id + this.expandContainers[i]+"Container").is(":visible")===false){
                        if (this.expandContainers[i]+"Container" === "additionalLayersContainer"){
                            this.activateIdentify = false;
                            lang.hitch(this, this.refreshIdentify(this.config.url)); 
                        }
                        lang.hitch(this, this.selectorTextReplace(e.currentTarget, "+", "-"));
                        $("#" + this.id + this.expandContainers[i]+"Container").animate({height:"toggle"}, 500);
                        $("#" + this.id + "-" +  this.expandContainers[i] + "Info").animate({height:"toggle"}, 500);                    	
                    }
                    else if ($("#" + this.id + this.expandContainers[i]+"Container").is(":visible")===true){
                        if (this.expandContainers[i]+"Container" === "additionalLayersContainer"){
                            this.activateIdentify = true;
                            lang.hitch(this, this.refreshIdentify(this.config.url)); 
                        }
                        $("#" + this.id + this.expandContainers[i]+"Container").animate({height:"toggle"}, 500);
                        $("#" + this.id + "-" + this.expandContainers[i] + "Info").animate({height:"toggle"}, 500);
                        lang.hitch(this, this.selectorTextReplace("#" + this.id + this.expandContainers[i]+"Expander", "-", "+"));
                    }                  
                }
//                //use framework identify if the "Layers" section is open, otherwise use app identify      
//                if ($("#" + this.id +"additionalLayersContainer").is(":visible")===false){
//                    console.log("true");
//                    this.activateIdentify = true;
//                    lang.hitch(this, this.refreshIdentify(this.config.url));
//                }
//                else{                   
//                    console.log("false");	                    	
//                    this.activateIdentify = false;
//                    lang.hitch(this, this.refreshIdentify(this.config.url));               	
//                }
               
            }));

            //handle exapnder separately for those div to keep open if another div is clicked
            this.expandContainersOpen = ["radarMetricChangerOpen", "consensusResultFilterSliderTierOpen", 
            "consensusResultFilterSliderSeverityOpen", "consensusResultCustomFilterOpen", ];
            for (var i=0; i<this.expandContainersOpen.length; i++){
                $("#" + this.id + this.expandContainersOpen[i] + "Container").hide();
                $("#" + this.id + this.expandContainersOpen[i] + "Expander").css( 'cursor', 'pointer' );
            }

            //on expander click loop through all expanders -- open this one and close all the others.  Also switch +/- 
            $('.bp_expanderOpen').on("click", lang.hitch(this, function(e){
                console.log("expander")
                var expander = e.currentTarget.id;
                var container = e.currentTarget.id.replace("Expander", "Container");
                for (var i=0; i<this.expandContainersOpen.length; i++){
                    if (this.id + this.expandContainersOpen[i]+"Expander" === expander){
                        if ($("#" + this.id + this.expandContainersOpen[i]+"Container").is(":visible")===false){
                        	
                            lang.hitch(this, this.selectorTextReplace(e.currentTarget, "+", "-"));
                    	
                        }
                        if ($("#" + this.id + this.expandContainersOpen[i]+"Container").is(":visible")===true){
                            lang.hitch(this, this.selectorTextReplace(e.currentTarget, "-", "+"));
                        }
                        $("#" + this.id + this.expandContainersOpen[i]+"Container").animate({height:"toggle"}, 500);
                    }
                }
            }));
            //download buttons
            lang.hitch(this, this.radarChartSetup());
            $('#' + this.id + 'dlConsensus').on('click',lang.hitch(this,function(e) { 
                //download zipped result
                e.preventDefault();
                window.location.href = this.config.zippedConsensusResultURL;                    
            }));            
            $('#' + this.id + 'dlConsensusExcel').on('click',lang.hitch(this,function(e) { 
                //download excel result
                e.preventDefault();
                window.location.href = this.config.excelConsensusResultURL;                    
            }));
        

            
            //build checkboxes for additonal layers
            lang.hitch(this, this.setUpAdditionalLayers(this.config.additionalLayers));
            
            //build select severity chosen
            if (this.config.includeBarrierSeverity === true){
                $("#" + this.id + "selectSeverity").chosen({allow_single_deselect:true, width:"220px"}).change(lang.hitch(this, function(c){
                    var v = c.target.value;
                    // check for a deselect
                    if (v.length == 0){v = "none";}
                    console.log(v);    
                    $("#" + this.id +"stateStatsExpander").show();
                    
                    //analytics event tracking
                    ga('send', 'event', {
                       eventCategory:this.config.analyticsEventTrackingCategory,        
                       eventAction: 'Select Severity', 
                       eventLabel: v + ' selected'
                    });
                    
                    
                    lang.hitch(this, this.selectBarrSeverity(v));
                }));
            }
            
            

            //build zoom-to chosen
            $("#" + this.id + "zoomState").chosen({allow_single_deselect:true, width:"130px"}).change(lang.hitch(this, function(c){
                var v = c.target.value;
                // check for a deselect
                if (v.length === 0){v = "none";}
                
                //analytics event tracking
                ga('send', 'event', {
                   eventCategory:this.config.analyticsEventTrackingCategory,        
                   eventAction: 'Zoom to state', 
                   eventLabel: v + ' selected for zoom'
                });   
            	lang.hitch(this, this.zoomToStates(v, "yes"));
            }));
            
            //build scenario selection
            if (this.config.includeMultipleScenarios === true){
                $("#" + this.id + "scenario").chosen({allow_single_deselect:true, width:"130px"}).change(lang.hitch(this, function(c){
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
            
            this.map.on("mouse-move", lang.hitch(this, function(evt){this.getCursorLatLong(evt);}));
            
            this.rendered = true;    

        },    
        
        
        selectBarrSeverity:function(v){
            if (this.selectSeverityCounter === 0){
                $("#" + this.id + "stateStatsExpander").trigger("click");
            }
            this.visibleLayers = [];
            this.visibleLayers.push(parseInt(v));
            this.dynamicLayer.setVisibleLayers(this.visibleLayers);    
            if (this.config.includeBarrierSeverity === true){this.currentSeverity = v;}
            else{this.currentSeverity = "";}
            if (this.currentSeverity ==='0'){
                $("#" + this.id + "consensusRadarUse").hide();
                $("#" + this.id + "consensusRadarNoUse").show();
            }
            else{
                $("#" + this.id + "consensusRadarUse").show();
                $("#" + this.id + "consensusRadarNoUse").hide();
            }
            console.log(this.visibleLayers);
            this.refreshBarChart();
            if (this.selectSeverityCounter >0){            
                lang.hitch(this, this.clearConsensusFilterMapService()); 
                lang.hitch(this, this.refreshIdentify(this.config.url));
            }

            this.selectSeverityCounter++;
            
            
        },
        
        
        zoomToStates: function(v, bool){
            //build zoom-to chosen
            var zoomExt = new Extent(this.config.zoomTo[v][0][0],this.config.zoomTo[v][0][1], this.config.zoomTo[v][0][2], this.config.zoomTo[v][0][3],
                  new SpatialReference({ wkid:3857 }));
            this.map.setExtent(zoomExt);
            lang.hitch(this,this.refreshBarChart()); 
            if (bool === "yes" && this.toggleBarriers !== false){
                $("#" + this.id +"barriers").trigger("click");
                $('#' + this.id + 'clickInstructions').show(); 
                $("#" + this.id +"consensusResultFiltersExpander").show();
                this.toggleBarriers = false;
            }
            
            
            lang.hitch(this, this.refreshIdentify(this.config.url));
            
            
            if (this.config.includeStratifiedRegions === true){
                lang.hitch(this, this.selectStratification());
            }
        },
        
        scenarioSelection: function(v, bool){
            //change the radar metrics displayed when sceanrio is changed
            if (v === "diad"){var scenarioRadarMetrics = this.config.diadromousRadarMetrics;}
            if (v === "res"){var scenarioRadarMetrics = this.config.residentRadarMetrics;}
            if (v === "bkt"){var scenarioRadarMetrics = this.config.brookTroutRadarMetrics;}
            lang.hitch(this, this.updateDefaultRadarMetrics(scenarioRadarMetrics));
            lang.hitch(this,this.refreshBarChart());
            lang.hitch(this, this.selectStratification());
            
            if (this.identifyIterator >0){
               lang.hitch(this, this.radarChart());
            }
            lang.hitch(this, this.refreshIdentify(this.config.url));
        },

        selectStratification: function(){
            var stratExtent = $("#" + this.id + "zoomState").val();
            var scenario = $("#" + this.id + "scenario").val();
            var primaryLayerKey = stratExtent + "_" + scenario;
            var primaryLayer = this.config.stratifiedLayers[primaryLayerKey];
            console.log("primary layer key = " + primaryLayerKey);
            
            this.visibleLayers = [primaryLayer]
            this.refreshBarChart();
            lang.hitch(this, this.clearConsensusFilterMapService());
            lang.hitch(this, this.refreshIdentify(this.config.url));
        },

        refreshBarChart: function(v){
            var v = $("#" + this.id + "zoomState").val();
            $("#" + this.id + "damSpan").text(this.config.zoomTo[v][1]["dams"]);    
            $("#" + this.id + "roadCrossingSpan").text(this.config.zoomTo[v][1]["crossings"+String(this.currentSeverity)]);
            $("#" + this.id + "avgNetSpan").text(this.round(this.config.zoomTo[v][1]["avgNetwork"+String(this.currentSeverity)]*0.000621371, 2));
            var avgNetRound = this.round(this.config.zoomTo[v][1]["avgNetwork"+String(this.currentSeverity)]*0.000621371, 2);    

            if (this.currentSeverity != "6"){
                if (this.currentSeverity ==="0"){
                    $("#" + this.id + "xingBarChartLabel").text("# Total Crossings");
                }
                else{
                    if (this.config.includeBarrierSeverity === true){
                        $("#" + this.id + "xingBarChartLabel").text("# " + this.config.severityNumDict[this.currentSeverity] + " (+) Crossings");
                    }
                    else{$("#" + this.id + "xingBarChartLabel").text("# Crossings");}
                }
                $("#" + this.id + "barChartCrossings").show();
                //$("#" + this.id + "xingBarChartLabel").show();
            }
            else{
                $("#" + this.id + "barChartCrossings").hide();
                //$("#" + this.id + "xingBarChartLabel").hide();
            }
            if (v != "Region"){
                lang.hitch(this, this.barChart("Dams", this.id + "barChartDams",  this.config.zoomTo[v][1]["dams"], this.config.zoomToMax.MaxSubRegion.dams, '#0000b4'));
                lang.hitch(this, this.barChart("Crossings", this.id + "barChartCrossings", this.config.zoomTo[v][1]["crossings"+String(this.currentSeverity)], this.config.zoomToMax.MaxSubRegion.crossings, '#0082ca'));
                lang.hitch(this, this.barChart("Avg Network (miles)", this.id + "barChartAvgNetwork", avgNetRound, this.config.zoomToMax.MaxSubRegion.avgNetwork*0.000621371, '#0094ff'));    
            }
            //use different max values for the whole region
            if (v == "Region"){
                lang.hitch(this, this.barChart("Dams", this.id + "barChartDams",  this.config.zoomTo["Region"][1]["dams"], this.config.zoomToMax.MaxRegion.dams, '#0000b4'));
                lang.hitch(this, this.barChart("Crossings", this.id + "barChartCrossings", this.config.zoomTo["Region"][1]["crossings"+String(this.currentSeverity)], this.config.zoomToMax.MaxRegion.crossings, '#0082ca'));
                lang.hitch(this, this.barChart("Avg Network (miles)", this.id + "barChartAvgNetwork", avgNetRound, this.config.zoomToMax.MaxRegion.avgNetwork*0.000621371, '#0094ff'));    
            }            
            
            if (this.config.includeBarrierSeverity === false && this.refreshBarChartCounter <2){
                $("#" + this.id + "barriers").trigger("click");
            }
            this.refreshBarChartCounter ++;
        },
        
        //calculate current metric weights
        metricWeightCalculator: function (gpVals){
            var sumWeights = 0; 
            for (key in gpVals) {
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
                //filterParameters.layerIds = this.obj.startingVisibleLayers;
                //layerDefs[this.obj.startingVisibleLayers] = filter;
                filterParameters.layerIds = this.visibleLayers;
                layerDefs[this.visibleLayers] = filter;
                
            }
            
            filterParameters.layerDefinitions = layerDefs;
            filterParameters.layerOption = ImageParameters.LAYER_OPTION_SHOW;
            filterParameters.transparent = true;
            var filteredMapServLayer = new esri.layers.ArcGISDynamicMapServiceLayer(mapServURL, 
                {"imageParameters" : filterParameters});
            return Object(filteredMapServLayer);
        },
        
        clearConsensusFilterMapService: function(){
            this.map.removeLayer(this.dynamicLayer);            
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
            this.obj.startingConsensusTierFilterMax = 20;
            this.obj.startingConsensusTierFilterMin = 1;
            
            this.dynamicLayer = new esri.layers.ArcGISDynamicMapServiceLayer(this.config.url);
            this.dynamicLayer.setVisibleLayers(this.visibleLayers);
            setTimeout(lang.hitch(this, function(){
                this.map.addLayer(this.dynamicLayer);
            },500));
            
          },    
          
          resetFilterSliders: function(){
              $( "#" + this.id + "consensusResultFilterSliderTier" ).slider( "values", 0, 1);
            $( "#" + this.id + "consensusResultFilterSliderTier" ).slider( "values", 1, 20);
            $( "#" + this.id + "consensusResultFilterSliderSeverity" ).slider( "values", 0, 1);
            $( "#" + this.id + "consensusResultFilterSliderSeverity" ).slider( "values", 1, 5);
        
            lang.hitch(this, this.displaySliderSelectedValues("#" + this.id + "consensusResultFilterSliderTier",this.consensusResultFilterSliderTierUI));
            lang.hitch(this, this.displaySliderSelectedValues("#" + this.id + "consensusResultFilterSliderSeverity",this.consensusResultFilterSliderSeverityUI));
          },
          
        filterConsensusMapServiceSlider: function(values){
            console.log(values);
            this.consensusTierMaxVal = 21-$('#' + this.id + 'consensusResultFilterSliderTier').slider("values", 0);
            this.consensusTierMinVal = 21-$('#' + this.id + 'consensusResultFilterSliderTier').slider("values", 1);
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
            this.map.removeLayer(this.dynamicLayer);
            if (this.consensusCustomFilter !="" && this.consensusCustomFilter  != undefined){this.consensusFilter = this.consensusSliderFilter + " AND " + this.consensusCustomFilter;}
            else{this.consensusFilter = this.consensusSliderFilter;}
                   
            this.dynamicLayer = this.filterMapService(this.consensusFilter, this.dynamicLayer, this.config.url);

            this.dynamicLayer.setVisibleLayers(this.visibleLayers);
            setTimeout(lang.hitch(this, function(){
                this.map.addLayer(this.dynamicLayer);
            },500));        
            lang.hitch(this, this.refreshIdentify(this.config.url, this.consensusFilter));

        },

        displaySliderSelectedValues: function(sliderID, ui){
            $(sliderID).next().find('span').each(lang.hitch(this,function(i,v){
                //console.log(ui.values[i]);
                if (sliderID.indexOf('Severity') !== -1){
                    var textVal = this.severityDict[ui.values[i]];
                }
                else{var textVal = 21-ui.values[i];}
                console.log(textVal);
                $(v).html(textVal);
            }));
        },


        selectRemovalBarriers: function() {  
            if($("input[name='graphicSelectBarriers2Remove']:checked").val()=="yes"){this.filterBarr = true;}
               
            if ($("input[name='graphicSelectBarriers2Remove']:checked").val()=="hide"){
                if (this.removeFeatureLayer){
                    this.map.removeLayer(this.removeFeatureLayer);
                    this.map.removeLayer(this.selectedBarriers);
                }
             }
            if ($("input[name='graphicSelectBarriers2Remove']:checked").val()=="show"){
                this.removingBarriers = true;
                this.activateIdentify = false;
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
                    if ($("#" + this.id + 'barriers2Remove').val() != ''){
                        lang.hitch(this, this.addSavedBarriersToRemove());
                    }
                    
                    this.removeFeatureLayer.on("click", lang.hitch(this, function(e){
                        this.currID = e.graphic.attributes[this.uniqueID];
                        console.log(this.currID);
                        for (i = 0; i< this.removeFeatureLayer.graphics.length; i++){  
                            if (this.alreadySelBarr2Remove != undefined && this.alreadySelBarr2Remove.indexOf(this.currID)>=0){
                                console.log(this.currID + "is already selected");
                            }               
                            //the following statement check if each graphic is either the one clicked on or in the list of previously selected 
                            if (this.removeFeatureLayer.graphics[i].attributes[this.uniqueID] == this.currID ){
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
                                        if (this.workingRemoveBarriersString == "''"){this.workingRemoveBarriersString = "";}
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
                    if (this.workingRemoveBarriersString == "''"){this.workingRemoveBarriersString = "";}
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
        
       applyWeights: function(myWeights) {  
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
                this.sumWeights = this.metricWeightCalculator(this.gpVals);      
                $('#'+ this.id + "bp_currWeight").text(this.sumWeights);
                if (this.sumWeights !=100){$('#'+ this.id +"bp_currWeight").css('color', 'red');}
                if (this.sumWeights ==100){$('#'+ this.id +"bp_currWeight").css('color', 'green');} 
            }
        },
        getCurrentWeights: function(){
                this.gpVals = {};
                this.weights = $("input[id^=" + this.id + "weightIn]").each(lang.hitch(this, function(i, v){
                    if (isNaN(parseFloat(v.value)) == true){v.id = 0;} 
                    if (v.value ==""){v.id = 0;}
                    else{this.gpVals[v.id] = v.value;}      
                    this.gpVals[v.id] = v.value;
                    if (parseFloat(v.value) > 0){$('#' + v.id).addClass('bp_weighted');}
                    else{$('#' + v.id).removeClass('bp_weighted');}                                
                }));
                //console.log(this.gpVals);
                this.sumWeights = this.metricWeightCalculator(this.gpVals);
                //console.log(this.sumWeights);
                $('#'+ this.id + "currWeight").text(this.sumWeights);
                if (this.sumWeights !=100){
                    $('#'+ this.id +"currWeight").css('color', 'red');
                }
                if (this.sumWeights ==100){
                    $('#'+ this.id +"currWeight").css('color', 'green');
                } 
        },
        
//************GP Service

//prepare and pass the GP request object to gpURL
        submit: function(){
            this.getCurrentWeights();
            if (this.sumWeights != 100){
                alert("Metric weights must sum to 100");
            }
            else{
                ga('send', 'event', {
                    eventCategory:this.config.analyticsEventTrackingCategory,        
                    eventAction: 'submit click', 
                    eventLabel: "Custom analysis on " + this.passability
                 });   
                 
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
                if($("input[name='filterBarriers']:checked").val()=="yes"){this.filterBarr = true;}
                else{this.filterBarr = false;}
            
                //if passability option is an input get it
                if (this.config.includePassabilityOption == true){
                    this.passability = $("#" + this.id + "passability").val();
	                if ($("input[name='takeAverage']:checked").val()=="yes"){this.takeAverage = true;}
	                else{this.takeAverage = false;}
                }

                if ($("#" + this.id + "userFilter").val() != ""){
                  this.filter = $("#" + this.id + "userFilter").val();
                }
                else{this.filter = "";}
                if ($("input[name='removeBarriers']:checked").val()=="yes"){this.removeBarr = true;}
                else{this.removeBarr = false;}
                this.removeIDs = $("#" + this.id + "barriers2Remove").val();
                
                if ($("input[name='runSumStats']:checked").val()=="yes"){this.runSumStats = true;}
                else{this.runSumStats = false;} 
                this.summarizeBy = $("#" + this.id + "summarizeBy").val();
                this.sumStatField = $("#" + this.id + "summaryStatField").val();
                
                

                
                if ($("#" + this.id + "exportCustomCSV").is(":checked")){
                    this.exportCSV = true;
                }
                else{this.exportCSV = false;}
                
                if (this.config.includePassabilityOption === true){
	                this.requestObject["Passability"] = this.passability;
	                this.requestObject["Take_Average_Value"] = this.takeAverage;
                }
                this.requestObject["FilterBarriers"] = this.filterBarr;
                this.requestObject["UserFilter"] = this.filter;
                this.requestObject["ModelRemoval"] = this.removeBarr;
                this.requestObject["Barriers_for_Modeled_Removal"] = this.removeIDs;
                this.requestObject["Run_Watershed_Summary_Stats"] = this.runSumStats;
                this.requestObject["Summarize_By"] = this.summarizeBy;
                this.requestObject["Summary_Stat_Field"] = this.sumStatField;
                this.requestObject["ExportCSV"] = this.exportCSV;
                this.weightIterator = 1;
                $.each(this.gpVals, lang.hitch(this, function(metric, weight){
                    if (weight >0){
                        var mNum = "Metric_" + this.weightIterator;
                        var mWeight = mNum + "_Weight";
                        var mOrder = mNum + "_Order";
                        if (this.config.gpServIncludesLogTransform == true){
                            var mLogTrans = mNum + "_Log_Transform";
                        }
                        var m = metric.replace(this.id + "weightIn-", "");
                        var prettyM = this.config.metricNames[m];
                        this.requestObject[mNum] = m;
                        this.requestObject[mWeight] = weight;
                        this.requestObject[mOrder] = this.config.metricOrder[m];
                        if (this.config.gpServIncludesLogTransform == true){
                            this.requestObject[mLogTrans] = "No";
                        }
                        this.weightIterator ++; 
                        if (this.config.tableResults == true){$("#" + this.id + "gpResultTable tr:first").append("<th>" + prettyM +"</th>");}
                    }
                }));

                console.log(this.requestObject);
                this.statusCallbackIterator = 0;
                
                this.gp.submitJob(this.requestObject, lang.hitch(this, this.completeCallback), lang.hitch(this, this.statusCallback), lang.hitch(this, function(error){
                        alert(error);
                        $('#' + this.id +"submitButton").removeClass('submitButtonRunning');
                        $('#' + this.id +"submitButton").prop('disabled', false);
                }));
                
                //disable Submit button so a second analyiss can't be run until the first is finished
                $('#' + this.id +"submitButton").addClass('submitButtonRunning');
                $('#' + this.id +"submitButton").prop('disabled', true);   
            }
        },

        //GP status
        statusCallback: function(jobInfo) {
            this.status = jobInfo.jobStatus;
            
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
                    if ((this.message != this.updateMessage) && (typeof this.message != 'undefined')){
                        $("#" + this.id +"gpStatusReport").html(this.message);
                        this.updateMessage = this.message;
                    }
                    if (this.message.startsWith("Succeeded at")){
                        $("#" + this.id +"gpStatusReport").html("Analysis completed successfully.  One moment, please...");
                    }
                    if (this.message.startsWith("Result exceeded transfer limit of")){
                        $("#" + this.id +"gpStatusReport").html("Analysis completed successfully.  One moment, please...");
                    }
                }
                this.statusCallbackIterator ++;
            }
        },
        
        //GP complete            
        completeCallback: function (jobInfo){
                $("#" + this.id +"gpStatusReport").html("Transferring data from server.");
                // Get result as map service -- needed for larger datasets and easy way to get legend
                this.resMapServURLRoot = this.config.gpURL.replace("GPServer/Prioritize", "MapServer/jobs/");
                this.resMapServ =  (this.resMapServURLRoot + jobInfo.jobId);
                this.gpResLayer = new esri.layers.ArcGISDynamicMapServiceLayer(this.resMapServ);
                this.gpResLayer.opacity = 0.8;
                this.map.removeLayer(this.dynamicLayer);
                this.map.addLayer(this.gpResLayer);
                console.log("callback complete");
                 this.jobInfo = jobInfo;
                // Get result JSON for graphics and linked table
                if (this.runSumStats == true){
                    console.log("stats");
                    this.gp.getResultData(jobInfo.jobId, this.config.summStatsParamName, lang.hitch(this,this.displayStats));
                    console.log("finished stats");
                }

                if (this.config.tableResults === false){
                    this.gp.getResultData(jobInfo.jobId, this.config.resultsParamName, lang.hitch(this, this.displayResultMapServ));              
                }
                this.gp.getResultData(jobInfo.jobId, this.config.zippedResultParamName, lang.hitch(this, this.getZippedResultURL));  
                this.gp.getResultData(jobInfo.jobId, this.config.csvResultParamName, lang.hitch(this, this.getCSVResultURL));  
                $( "#" + this.id + "customAnalysisResultsAccord" ).trigger( "click" );
       
                this.statusCallbackIterator = 0;
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
            
            //re-enable Submit button for subsequent analyses
            $('#' + this.id +"submitButton").removeClass('bp_submitButtonRunning');
            $('#' + this.id +"submitButton").prop('disabled', false);
            
            //set identify to GP service
            //this.identifyRes = new IdentifyTask(this.resMapServ);
            this.activateIdentify = true;
            this.useRadar = false;
            lang.hitch(this, this.refreshIdentify(this.resMapServ));                                
        },


        //Display Summary Stats table
        displayStats:  function(result, messages){
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
                //Set up tablesorter           
                // require(["jquery", "plugins/barrier-prioritization-proto2/js/jquery.tablesorter.combined.js"],lang.hitch(this,function($) {
                            // $("#" + this.id + "gpSumStatsTable").tablesorter({
                            // widthFixed : true,
                            // headerTemplate : '{content} {icon}', // Add icon for various themes
                            // widgets: [ 'zebra', 'stickyHeaders' ], 
                            // theme: 'blue',
                            // widgetOptions: {
                                // //jQuery selector or object to attach sticky header to
                                // stickyHeaders_attachTo: '.gpSumStatsTableDivContainer',
                                // stickyHeaders_includeCaption: false, // or $('.wrapper')   
                        // }
                    // });   
                    // console.log("tablesort initialized");
                    // $('#' + this.id + 'gpSumStatsTable').trigger("update");
                    // var sorting = [[0]];                         
                    // setTimeout(lang.hitch(this,function () {
                        // $("#" + this.id + "gpSumStatsTable").trigger("sorton", [sorting]);
                    // }, 100));
                // }));
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
        
        radarChartSetup: function(){
            $("#"+ this.id + "selectRadarAttrs").chosen({allow_single_deselect:true, width:"300px"});
            this.radarAttrs = "";
            for (var key in this.config.metricShortNames) {
                if (this.config.metricShortNames.hasOwnProperty(key)) {
                    //console.log(key + " -> " + this.config.metricShortNames[key]);
                    this.radarAttrs += "<option value='" + key + "'>" + this.config.metricShortNames[key] + "</option>";
                }
            }
            $("#" + this.id + "selectRadarAttrs").html(this.radarAttrs);
            
            //this sets the starting radar metrics to be shown via config array
            lang.hitch(this, this.updateDefaultRadarMetrics(this.obj.startingRadarMetrics));
            
//            this.startingRadarMetrics = []; //array from obj 
//            for (var i=0; i<this.obj.startingRadarMetrics.length; i++){ 
//                this.startingRadarMetrics.push(this.obj.startingRadarMetrics[i]);
//            };
            
//            //This set the weighted anadromous metrics to show in the radar by default 
//            $.each(this.config.diadromous, lang.hitch(this, function(k, v){
//                console
//                if (v >0){
//                    this.startingRadarMetrics.push("PR" + k);
//                }
//             }));
                         
            $("#" + this.id + "selectRadarAttrs").val(this.currentRadarMetrics).trigger('chosen:updated');
            //listen for changes to selected radar metrics
            $("#"+ this.id + "selectRadarAttrs").on("change", lang.hitch(this, function(){
                if (this.identifyIterator >0){
                    lang.hitch(this, this.radarChart());
                    
                    //analytics event tracking
                    ga('send', 'event', {
                       eventCategory:this.config.analyticsEventTrackingCategory,        
                       eventAction: 'changing radar metrics', 
                       eventLabel: 'changing radar metrics'
                    });
                }
            }));
        },

        updateDefaultRadarMetrics: function(defaultRadarMetrics) {
            console.log(defaultRadarMetrics);
            this.currentRadarMetrics = []; //array from config 
            for (var i=0; i< defaultRadarMetrics.length; i++){ 
                this.currentRadarMetrics.push(defaultRadarMetrics[i]);
            };
            $("#" + this.id + "selectRadarAttrs").val(this.currentRadarMetrics).trigger('chosen:updated');
        },
        
        radarChart: function(){
            var margin = {top: 45, right: 45, bottom: 45, left: 45},
                width = Math.min(300, window.innerWidth - 10) - margin.left - margin.right,
                height = Math.min(width, window.innerHeight - margin.top - margin.bottom - 20);
                    
            ////////////////////////////////////////////////////////////// 
            //////////////////// Draw the Chart ////////////////////////// 
            ////////////////////////////////////////////////////////////// 

            var color = d3.scaleOrdinal(d3.schemeCategory10)
                .range(["#CC333F","#00A0B0"]);
                //.range(["#EDC951","#CC333F","#00A0B0"]);
                
            var radarChartOptions = {
              w: width,
              h: height,
              margin: margin,
              maxValue: 1,
              levels: 5,
              roundStrokes: true,
              color: color
            };

            //only show those attributes selected by user - take the text labels, not the values since the radar
            //axis use the labels
            var userFilterArray = $("#" + this.id + "selectRadarAttrs").val();
            this.userFilterArray=[];
            for (var i=0; i< userFilterArray.length; i++){
                this.userFilterArray.push(this.config.metricShortNames[userFilterArray[i]]);
            }
            this.radarDataFiltered = this.grepFilterbyArray(this.radarData, this.userFilterArray);
            this.temp = [];
            this.temp.push(this.radarDataFiltered);
            this.radarDataFiltered = this.temp;
            this.RadarChart.draw("#" + this.id + "consensusRadarContainer", this.radarDataFiltered, radarChartOptions, this);
        },        

        barChart: function(theme, chartSelector, d, maxVal, color){
            var categories = [];
            var values = [];
            values.push(d);
            categories.push(theme);  
            var xscale = d3.scaleLinear()
                            .domain([0,maxVal])
                            .range([0,200]);
    
            var yscale = d3.scaleLinear()
                            .domain([0,categories.length])
                            .range([0,10]);

            d3.select("#" + chartSelector).select("svg").remove();
            var canvas = d3.select("#" + chartSelector)
                            .append('svg')
                            .attr("id", chartSelector + "svg")
                            .attr('width',300)
                            .attr('height',20);
     
            var chart = canvas.append('g')
                                .attr("transform", "translate(0,0)")
                                .attr('id',chartSelector + 'bars')
                                .selectAll('rect')
                                .data(values)
                                .enter()
                                .append('rect')
                                .attr('height',18)
                                .attr('x',0)
                                .attr('y', function(d,i){ return yscale(i); })
                                .style('fill',color)
                                .attr('width',function(d){ return 0; });
    
            var transit = d3.select("#" + chartSelector + "svg").selectAll("rect")
                                .data(values)
                                .transition()
                                .duration(1000) 
                                .attr("width", function(d) {return xscale(d); });
    
            var transitext = d3.select('#' + chartSelector + 'bars')
                                .selectAll('text')
                                .data(values)
                                .enter()
                                .append('text')
                                .attr('x',function(d) {return xscale(d)-0; })
                                .attr('y',function(d,i){ return yscale(i)+14; })
                                .text(function(d){ return " " + d;}) //+" " + theme; }) //This adds a label - can use inseatd of     
                                    .style('fill','#000000')
                                    .style('font-size','12px');
        
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
                        '<span class="fa fa-info-circle info" title="' + v[3] + '"></span>' +
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
                    if ((this[addlLayer].minscale != 0 && this.map.getScale() >this[addlLayer].minscale) ||( this[addlLayer].maxscale != 0 && this.map.getScale() < this[addlLayer].maxscale)){
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
                if (v[4] == "on" || this.obj.startingAdditionalLayers[v[0]]=="on"){$("#" + this.id + v[0]).trigger("click");}
            }));
            
            //set up barrier default toggle.  This is done separately, since it is not listed in the additional layers of the config file
            $("#" + this.id + "barriers").on('click', lang.hitch(this, function(e) {
                var ischecked = $("#"+ this.id + "barriers").is(':checked');
                if (ischecked) {
                    this.map.addLayer(this.dynamicLayer);
                    //Commented out so that don't turn on custom popup and radar every time primary layer is turned on
                    //this.activateIdentify = true;
                    //lang.hitch(this, this.refreshIdentify(this.url));
                    $("#" + this.id + "barrierstransp").show();
                }
                else{
                    this.map.removeLayer(this.dynamicLayer);
                    //this.activateIdentify = false; 
                    //this.refreshIdentify();
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
                        if (control[0].id.indexOf("barriers") != -1){
                            this.dynamicLayer.setOpacity(ui.value / 100);
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
            var arrData = typeof JSONData != 'object' ? JSON.parse(JSONData) : JSONData;
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
            console.log("identify active = " +this.activateIdentify);
            
            this.idLayerURL = layerURL;
            if (this.activateIdentify === false){ 
            	//this is the generic framework identify
            	this.allowIdentifyWhenActive = true;
                dojo.disconnect(this.identifyClick);
            }
            if (this.activateIdentify === true){
                console.log("visible layers = " + this.visibleLayers)
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
                    console.log("querying layer # " + visLayer);
                }
                else{var visLayer = 0;}
          
                this.identifyParams.layerIds = visLayer;
                this.identifyParams.layerDefinitions=[];
                if (layerURL === this.config.url && this.config.includeBarrierSeverity === true){
                    var idLayer = parseInt(this.currentSeverity);
                }
                else{var idLayer = 0;}
                console.log(idLayer);
                console.log(visLayer);
                if (layerDef !== undefined){
                    this.identifyParams.layerDefinitions[idLayer] = layerDef;
                    console.log("layer def= " + this.identifyParams.layerDefinitions);
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
            console.log(evt)
            if (this.activateIdentify === true){
                console.log("LayerDefs = " + this.identifyParams.layerDefinitions);
                console.log("Layer IDs = " + this.identifyParams.layerIds);
                this.identifyRes = new IdentifyTask(this.idLayerURL);
                this.identifyParams.geometry = evt.mapPoint;
                this.identifyParams.mapExtent = this.map.extent;
                this.identifyIterator = 0; 
                
//                this.identifyRes.execute(this.identifyParams, function(idResults){console.log(idResults)})
                
                this.identifyRes        
                    .execute(this.identifyParams)
                    .addCallback(lang.hitch(this, function (response) {
                        console.log(response);
                        if (this.identifyIterator ===0 && response[0].feature){
                            console.log(response[0].feature);
                            lang.hitch(this, this.displayIDResult(response[0].feature, this.identifyParams.geometry));
                        }
                        this.identifyIterator ++;    
                        this.idContent = "";
                }));
             }        
             
        },
        
        displayIDResult: function(idResult, point){
            this.idContent="";
            this.radarData =[];
            this.allClickData = {}; //build an object to get the all real values.  Used in RadarChart.js to make tooltip labels

            $.each(idResult.attributes, lang.hitch(this, function(k, v){ 
                this.allClickData[k] = v; 
                if (this.idLayerURL === this.config.url && this.config.includeBarrierSeverity === true){
                    var metricSev = "s"+String(this.currentSeverity);
                }

                else{var metricSev = k;}
                //console.log(metricSev)
                if (k.startsWith(metricSev)===true){
                    if (this.idLayerURL === this.config.url && this.config.includeBarrierSeverity === true){
                           var basename = k.replace(metricSev, "");
                       }
                       else{var basename = k;}
                       // console.log(k);
                       // console.log(basename);
                       // console.log(k + "=" + v);
                    if ($.inArray(k, this.config.idBlacklist) == -1){
                        
                        //don't show indivudal metric values if consensus (average result)
                        if (this.currentSeverity !="0"){

                            //convert meter results to miles, round if a number, take value as is if not a number, use yes or no if unit is yes/no
                            if (this.config.metricMetersToMiles.indexOf(basename)!=-1){
                                var vDisplay = String(this.round(v * 0.000621371, 2)) + " miles";
                            }
                            else if(isNaN(v)==false){vDisplay = this.round(v, 2);}
                            else{vDisplay = v;}
                            if(this.config.metricUnits[basename] === "yes/no"){
                                if(parseInt(v)==0){vDisplay ="no";}
                                if(parseInt(v)==1){vDisplay ="yes";}
                            }
                               
                            //HTML for identify popup -- loop through and include all fields except those in plugin-config blakclist
                            if (this.config.metricNames[basename] != undefined){
                                //console.log(this.config.metricNames[basename]);
                                this.idContent = this.idContent + "<b>" + this.config.metricNames[basename] + "</b> : " + vDisplay + "<hr>";
                            }
                            if (this.config.idWhiteList[basename] != undefined){
                                this.idContent = this.idContent + "<b>" + basename+ "</b> : " + vDisplay + "<hr>";
                            }
                        }
                        else{
                            this.idContent = "Individual metric values are not available for the averaged result.  Select a different barrier severity to view individual metric values";
                        }
                        
                    }
                }    
        
                if (this.useRadar === true){
                    if (this.config.includeBarrierSeverity === true){
                        var PRsev = "PR" + String(this.currentSeverity);
                    }
                    else{var PRsev = "PR";}
                    basename = k.replace(PRsev, "");
                        
                    //convert meter results to miles, round if a number, take value as is if not a number, use yes or no if unit is yes/no
                    if (this.config.metricMetersToMiles.indexOf(basename)!=-1){
                        var vDisplay = String(this.round(v * 0.000621371, 2)) + " miles";
                    }
                    else if(isNaN(v)==false){vDisplay = this.round(v, 2);}
                    else{vDisplay = v;}
                    if(this.config.metricUnits[basename] === "yes/no"){
                        if(parseInt(v)==0){vDisplay ="no";}
                        if(parseInt(v)==1){vDisplay ="yes";}
                    }
                    if (k.startsWith(PRsev) === true && this.config.metricNames[basename] != undefined){
                        this.radarItem = {};
                        this.radarItem["axis"] = this.config.metricShortNames[basename];
                        this.radarItem["coreName"] = basename;
                        this.radarItem["unit"]= this.config.metricUnits[basename];
                        this.radarItem["value"] =parseFloat(v)/100;
                        this.radarItem["valDisp"]=vDisplay;
                        this.radarData.push(this.radarItem);
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

                    if (this.allClickData[this.config.barrierTypeField]==="Crossing" && survID != ""){
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
                    if (this.allClickData[this.config.barrierTypeField]==="Dam" &&  this.allClickData["FERC"] != ""){
                            var type= 'Dam (FERC prj: ' + this.allClickData["FERC"] + ') + <br>NOI Exp Date: ' + this.allClickData["FERC_NOIExpDate"];
                    }
                    if (this.allClickData[this.config.barrierTypeField]==="Dam" &&  this.allClickData["FERC"] ===  ""){
                            var type= 'Dam (No known FERC prj)';
                    }
                }
                else {var type="Dam";}
            }
            else{var type="Natural Barrier";}
            
            if (this.config.includeBarrierSeverity === true && this.currentSeverity !=0){
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
            
            //if included show the stratification region
            if (this.config.includeStratifiedRegions === true){
                var stratRegion = $("#" + this.id + "zoomState").val()
            }
            else{var stratRegion = ""}
            //if included, show the resident & BKT tiers in the radar plot header
            if (this.config.anadTierName != "" && this.config.anadTierName != false){
                this.clickHeader += "<br/>" + stratRegion + " Diadromous Tier= " + this.allClickData[this.config.anadTierName];
            } 
            if (this.config.residentTierName != "" && this.config.residentTierName != false){
                this.clickHeader += "<br/>" + stratRegion + " Resident Tier= " + this.allClickData[this.config.residentTierName];
            }       
            if (this.config.bktTierName != "" && this.config.bktTierName != false){
                this.clickHeader += "<br/>" + stratRegion + " Brook Trout Tier= " + this.allClickData[this.config.bktTierName];
            }                   
            
            if (this.config.includeFactSheets === true){
            	this.clickHeader += "<br/><a target='_blank' href='plugins/barrier-prioritization-proto2/factSheets/" + this.allClickData[this.config.uniqueID] + ".pdf'>Fact Sheet</a>";
            }
                        
            //show iteration being used if including barrier severity, it's not the average value, and it's not a GP service result
            if (this.config.includeBarrierSeverity === true && this.currentSeverity !="0" && this.idLayerURL === this.config.url){    
                this.clickHeader = this.clickHeader + "<br/>All values for " + radarSeverityDisplay;
            }
            
            if (this.useRadar === true){
                console.log(this.radarData);
                console.log(this.identifyParams.layerDefinitions)
                lang.hitch(this, this.radarChart());
                $("#" + this.id +"radarHeader").html(this.clickHeader);
                //hide the click instructions and show the "Assess a barrier" div if not visible - on first click
                $('#' + this.id + 'clickInstructions').hide();  
                
                if (this.identifyIterator ===0){
                    //go to the "Explore Consensus Accordion" if not currently
                    if ($("#" + this.id + "exploreConsensusSection").is("visible")===false){
                        $("#" + this.id + "exploreConsensusAccord").trigger("click");
                    }
                    if ($("#" + this.id +"consensusRadarBlockExpander").is(":visible") == false){
                        $("#" + this.id +"consensusRadarBlockExpander").show();
                        $("#" + this.id +"consensusRadarBlockExpander").trigger("click");
                    }
                    //switch to the radar plot on every identify click -- No -- don't like this
                    // if ($("#" + this.id +"consensusRadarBlockExpander").html().indexOf("-") == -1){
                        // $("#" + this.id +"consensusRadarBlockExpander").trigger("click");
                    // }
                    
                       $("#" + this.id +"radarMetricChangerOpenExpander").show();
                       $("#" + this.id +"consensusResultFiltersExpander").show();
                }
            }    

            //if using radar plot, don't show metric values in popup
            if (this.useRadar === true){
                this.idContent = this.clickHeader
            }
            else{this.idContent = this.clickHeader + "<hr>" + this.idContent;}
            
            this.identJSON = {
                title: "${" + this.uniqueID+ "} = Tier ${" + tierName +"}",
                content: this.idContent
            };
            this.popupInfoTemplate = new esri.InfoTemplate(this.identJSON);
            idResult.setInfoTemplate(this.popupInfoTemplate);    
            this.map.infoWindow.show(point);            
            this.map.infoWindow.resize(300,400); //switching to framework identify can cause this popup to resize wrong.  So be explicit    
            this.map.infoWindow.setFeatures([idResult]);
               
        },            
//End of functions...
    });
});