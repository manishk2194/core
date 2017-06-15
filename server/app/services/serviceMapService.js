/*
 Copyright [2016] [Relevance Lab]

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

const logger = require('_pr/logger')(module);
var async = require('async');
var apiUtil = require('_pr/lib/utils/apiUtil.js');
var services = require('_pr/model/services/services.js');
var fileUpload = require('_pr/model/file-upload/file-upload');
var monitors = require('_pr/model/monitors/monitors');
var masterUtil = require('_pr/lib/utils/masterUtil.js');
var monitorsModel = require('_pr/model/monitors/monitors.js');
const jsYml= require('js-yaml');
var uuid = require('node-uuid');
var resourceModel = require('_pr/model/resources/resources');
var commonService = require('_pr/services/commonService');

var serviceMapService = module.exports = {};

serviceMapService.getAllServicesByFilter = function getAllServicesByFilter(reqQueryObj,callback){
    var reqData = {};
    async.waterfall([
        function (next) {
            apiUtil.paginationRequest(reqQueryObj, 'services', next);
        },
        function(paginationReq,next){
            reqData = paginationReq;
            apiUtil.databaseUtil(paginationReq, next);
        },
        function (queryObj, next) {
            services.getLastVersionOfEachService(queryObj.queryObj,function(err,data){
                if(err){
                    next(err,null);
                }else if(data.length > 0){
                    services.getAllServicesByFilter(queryObj, function(err,filterData){
                        if(err){
                            next(err,null);
                        }else{
                            var response = {
                                docs:filterData,
                                total:data.length,
                                limit:queryObj.options.limit,
                                page:queryObj.options.page,
                                pages:Math.ceil(data.length / queryObj.options.limit)
                            };
                            next(null,response);
                        }
                    });
                }else{
                    var response = {
                        docs:data,
                        total:data.length,
                        limit:queryObj.options.limit,
                        page:queryObj.options.page,
                        pages:Math.ceil(data.length / queryObj.options.limit)
                    };
                    next(null,response);
                }
            })
        },
        function(services,next){
            changeServiceResponse(services,next);
        },
        function(serviceList,next){
            apiUtil.paginationResponse(serviceList, reqData, next);
        }
    ],function(err,results){
        if(err){
            logger.error(err);
            callback(err,null);
            return;
        }else{
            callback(null,results);
            return;
        }
    })

};
serviceMapService.deleteServiceById = function deleteServiceById(serviceId,callback){
    async.waterfall([
        function(next){
            services.getServiceById(serviceId,next);
        },
        function(servicesData,next){
            if(servicesData.length > 0){
                services.updateService({name:servicesData[0].name},{isDeleted:true},next);
            }else{
                var err =  new Error();
                err.code = 500;
                err.message = "No Service is available in DB against Id "+serviceId;
                next(err,null);
            }
        }
    ],function(err,results){
        if(err){
            callback(err,null);
            return;
        }else{
            callback(null,results);
            return;
        }
    })
}

serviceMapService.getAllServiceVersionByName = function getAllServiceVersionByName(serviceName,reqQueryObj,callback){
    var reqData = {};
    async.waterfall([
        function (next) {
            apiUtil.paginationRequest(reqQueryObj, 'versions', next);
        },
        function(paginationReq,next){
            reqData = paginationReq;
            apiUtil.databaseUtil(paginationReq, next);
        },
        function(queryObj,next){
            queryObj.queryObj.name = serviceName;
            services.getServicesWithPagination(queryObj,next);
        },
        function(services,next){
            if(services.docs.length > 0){
                var versionList = [];
                services.docs.forEach(function(service){
                    versionList.push(service.version);
                });
                services.docs = versionList;
                next(null,services);
            }else{
                next(null,services);
            }
        },
        function(serviceList,next){
            apiUtil.paginationResponse(serviceList, reqData, next);
        }
    ],function(err,results){
        if(err){
            callback(err,null);
            return;
        }else{
            callback(null,results);
            return;
        }
    })
}

serviceMapService.createNewService = function createNewService(servicesObj,callback){
    if(servicesObj.ymlFileId && servicesObj.ymlFileId !== null) {
        services.createNew(servicesObj, function (err, servicesData) {
            if (err) {
                logger.error("services.createNew is Failed ==>", err);
                callback(err, null);
                return;
            } else {
                callback(null, servicesData);
                return;
            }
        });
    }else{
        services.getServices({name:servicesObj.name},function(err,data) {
            if (err) {
                logger.error("Error in getting Services against Service Name: ", servicesObj.name, err);
                return callback(err, null);
            } else if (data.length > 0) {
                return callback({code: 400, message: "Service Name is already associated with other Services.Please enter unique Service Name."}, null);
            } else {
                fileUpload.getReadStreamFileByFileId(servicesObj.fileId, function (err, fileDetail) {
                    if (err) {
                        logger.error("Error in reading YML File.");
                        var error =new Error();
                        error.code = 500;
                        error.message = "Error in reading YML File."
                        return callback(error, null);
                    } else {
                        try {
                            var result = jsYml.safeLoad(fileDetail.fileData);
                            if (result !== null) {
                                    servicesObj.identifiers = result;
                                    servicesObj.type = 'Service';
                                    servicesObj.ymlFileId = servicesObj.fileId;
                                    servicesObj.createdOn = new Date().getTime();
                                    getMasterDetails(servicesObj.masterDetails, function (err, result) {
                                        if (err) {
                                            logger.error("Unable to Master Details");
                                            callback(err, null);
                                            return;
                                        } else {
                                            monitorsModel.getById(servicesObj.monitorId, function (err, monitor) {
                                                servicesObj.masterDetails = result;
                                                servicesObj.masterDetails.monitor = monitor;
                                                servicesObj.state = 'Initializing';
                                                servicesObj.version = 1.0;
                                                services.createNew(servicesObj, function (err, servicesData) {
                                                    if (err) {
                                                        logger.error("services.createNew is Failed ==>", err);
                                                        callback(err, null);
                                                        return;
                                                    } else {
                                                        callback(null, servicesData);
                                                        return;
                                                    }
                                                });
                                            });
                                        }
                                    });
                                } else {
                                var err = new Error("There is no data present YML.")
                                err.code = 403;
                                callback(err, null);
                            }
                        } catch(err){
                            return callback({code:500,message:'Invalid YAML : '+err.message}, null);
                        }
                    }
                });
            }
        });
    }
}

serviceMapService.updateServiceById = function updateServiceById(serviceId,data,callback){
    async.waterfall([
        function(next){
            services.getServiceById(serviceId,next);
        },
        function(servicesData,next){
            if(servicesData.length > 0){
                services.updateServiceById(serviceId,data,next);
            }else{
                logger.debug("No Service is available in DB against serviceId");
                next(null,null);
            }
        }
    ],function(err,results){
        if(err){
            callback(err,null);
            return;
        }else{
            callback(null,results);
            return;
        }
    })
}

serviceMapService.getLastVersionOfEachService = function getLastVersionOfEachService(filterBy,callback){
    async.waterfall([
        function(next){
            services.getLastVersionOfEachService(filterBy,next);
        },
        function(servicesData,next){
            if(servicesData.length > 0){
                next(null,servicesData);
            }else{
                logger.debug("No Service is available in DB: ");
                next(null,servicesData);
            }
        }
    ],function(err,results){
        if(err){
            callback(err,null);
            return;
        }else{
            callback(null,results);
            return;
        }
    })
}

serviceMapService.updateService = function updateService(filterQuery,data,callback){
    async.waterfall([
        function(next){
            services.getServices(filterQuery,next);
        },
        function(servicesData,next){
            if(servicesData.length > 0){
                services.updateService(filterQuery,data,next);
            }else{
                var err =  new Error();
                err.code = 500;
                err.message = "No Service is available in DB against filterQuery "+filterQuery;
                next(err,null);
            }
        }
    ],function(err,results){
        if(err){
            callback(err,null);
            return;
        }else{
            callback(null,results);
            return;
        }
    })
}

serviceMapService.resourceAuthentication = function resourceAuthentication(serviceId,resourceId,credentials,callback){
    async.waterfall([
        function(next){
            services.getServiceById(serviceId,next);
        },
        function(servicesData,next){
            if(servicesData.length >0){
                resourceModel.getResourceById(resourceId,function(err,resourceDetail){
                    if(err){
                        var error =  new Error();
                        error.code = 500;
                        error.message = "Error in getting Resource Details By Id: "+resourceId +' : '+ err;
                        next(error,null);
                    }
                    if(resourceDetail !== null) {
                        next(null, {code: 202, message: "Authentication is in Progress"});
                        services.updateService({
                            'name': servicesData[0].name,
                            'resources': {$elemMatch: {id: resourceId}}
                        }, {
                            'resources.$.authentication': 'authenticating',
                        }, function (err, result) {
                            if (err) {
                                logger.error("Error in updating Service State:", err);
                            }
                        })
                        resourceModel.updateResourceById(resourceId, {
                                'authentication': 'authenticating'
                            }, function (err, data) {
                            if (err) {
                                logger.error("Error in updating BootStrap State:", err);
                            }
                        });
                        checkCredentialsForResource(resourceDetail,serviceId,resourceId,credentials,servicesData[0],function(err,data){
                            if(err){
                                logger.error("Error in checking Authentication Credentials:",err);
                            }
                        })
                    }else{
                        var err =  new Error();
                        err.code = 500;
                        err.message = "No Resource is available in DB against resourceId: "+resourceId;
                        next(err,null);
                    }
                })
            }else{
                var err =  new Error();
                err.code = 500;
                err.message = "No Service is available in DB against serviceId: "+serviceId;
                next(err,null);
            }
        }
    ],function(err,results){
        if(err){
            callback(err,null);
            return;
        }else{
            callback(null,results);
            return;
        }
    })
}

serviceMapService.getServices = function getServices(filterQuery,callback){
    async.waterfall([
        function(next){
            services.getServices(filterQuery,next);
        }
    ],function(err,results){
        if(err){
            callback(err,null);
            return;
        }else{
            callback(null,results);
            return;
        }
    })
}


serviceMapService.updateServiceMapVersion = function updateServiceMapVersion(resourceId,callback){
    async.waterfall([
        function(next){
            services.getServices({resources:{$elemMatch:{id:resourceId}}},next);
        },
        function(serviceList,next){
            async.parallel({
                resourceSync: function (callback) {
                    resourceModel.updateResourceById(resourceId, {
                        isDeleted: true
                    }, callback)
                },
                serviceSync: function (callback) {
                    if (serviceList.length > 0) {
                        var count = 0;
                        serviceList.forEach(function (service) {
                            if (service.resources.length === 1) {
                                service.resources = [];
                                service.state = 'Initializing';
                                service.version = service.version + 0.1;
                                service.version = parseFloat(service.version).toFixed(1);
                                services.createNew(service, function (err, data) {
                                    if (err) {
                                        logger.error(err);
                                    }
                                    count++;
                                    if (count === serviceList.length) {
                                        callback(null, serviceList);
                                    }
                                })
                            } else {
                                var resourceCount = 0, serviceStateList = [];
                                service.resources.forEach(function (resource) {
                                    resourceCount++;
                                    if (resource.id === resourceId) {
                                        service.resources.splice(resourceCount - 1, 1);
                                    }
                                    if (resource.authentication === 'failed') {
                                        serviceStateList.push('authentication_error');
                                    } else if (resource.bootStrapState === 'failed') {
                                        serviceStateList.push('bootStrap_failed');
                                    } else if (resource.bootStrapState === 'bootStrapping') {
                                        serviceStateList.push('bootStrapping');
                                    } else {
                                        serviceStateList.push(resource.state);
                                    }
                                });
                                service.state = getServiceState(serviceStateList);
                                service.version = service.version + 0.1;
                                service.version = parseFloat(service.version).toFixed(1);
                                services.createNew(service, function (err, data) {
                                    if (err) {
                                        logger.error(err);
                                    }
                                    count++;
                                    if (count === serviceList.length) {
                                        callback(null, serviceList);
                                    }
                                })
                            }

                        })
                    } else {
                        callback(null, serviceList);
                    }
                }
            },function(err,results){
                if(err){
                    next(err,null);
                }else{
                    next(null,results);
                }
            })
        }
    ],function(err,results){
        if(err){
            callback(err,null);
            return;
        }else{
            callback(null,results);
            return;
        }
    })
}

serviceMapService.getAllServiceResourcesByName = function getAllServiceResourcesByName(serviceName,filterQuery,callback){
    async.waterfall([
        function (next) {
            var queryObj = {
                name:serviceName
            }
            if(filterQuery.version && filterQuery.version === 'latest'){
                services.getLastVersionOfEachService(queryObj,next);
            }else if(filterQuery.version){
                queryObj.version = parseFloat(filterQuery.version);
                services.getServices(queryObj,next);
            }else{
                services.getServices(queryObj,next);
            }
        },
        function(serviceList,next) {
            if (serviceList.length > 0) {
                var filterResourceList = [];
                serviceList.forEach(function(service){
                    var filterObj = {
                        version:filterQuery.version?filterQuery.version:service.version.toFixed(1),
                        state:service.state,
                        resources:[]
                    }
                    service.resources.forEach(function (resource) {
                        if(Object.keys(filterQuery).length ===1 && filterQuery.version){
                                filterObj.resources.push(resource);
                        }else if(Object.keys(filterQuery).length > 0){
                            Object.keys(filterQuery).forEach(function(key){
                                if(key!== 'version' && filterQuery[key] === resource[key]){
                                    filterObj.resources.push(resource);
                                }
                            })
                        }else{
                            filterObj.resources.push(resource);
                        }
                    });
                    filterResourceList.push(filterObj);
                });
                next(null, filterResourceList);
            } else {
                next(null, []);
            }
        }
    ],function(err,results){
        if(err){
            callback(err,null);
            return;
        }else{
            callback(null,results);
            return;
        }
    })
}

serviceMapService.getServiceById = function getServiceById(serviceId,callback){
    async.waterfall([
        function(next){
            services.getServiceById(serviceId,next);
        },
        function(serviceList,next){
            changeServiceResponse(serviceList,next);
        }
    ],function(err,results){
        if(err){
            callback(err,null);
            return;
        }else{
            callback(null,results[0]);
            return;
        }
    })
}

function changeServiceResponse(services,callback){
    var serviceList  = [],resultList =[];
    if(services.docs && services.docs.length > 0){
        serviceList = services.docs;
    }else{
        serviceList = services;
    }
    if(serviceList.length > 0){
        var count = 0;
        for(var  i = 0 ; i < serviceList.length; i++){
            (function(service){
                formattedServiceResponse(service,function(err,data){
                    if(err){
                        logger.error("Error in formatted Service Response:");
                    }
                    count++;
                    if(data !== null) {
                        resultList.push(data);
                    }
                    if(count === serviceList.length){
                        if(services.docs && services.docs.length > 0){
                            services.docs = resultList;
                        }else{
                            services = resultList;
                        }
                        return callback(null,services);
                    }
                })
            })(serviceList[i]);
        }
    }else{
        return callback(null,serviceList);
    }
}

function formattedServiceResponse(service,callback){
    var serviceObj = {
        id:service.id,
        name:service.name,
        type:service.type,
        desc:service.desc,
        state:service.state,
        createdOn:service.createdOn,
        updatedOn:service.updatedOn,
        version:service.version.toFixed(1)
    }
    getMasterDetails(service.masterDetails,function(err,data){
            if(err){
                return callback(err,null);
            }
            serviceObj.masterDetails = data;
            serviceObj.masterDetails.monitor = service.masterDetails.monitor;
            if(service.ymlFileId){
                fileUpload.getReadStreamFileByFileId(service.ymlFileId,function(err,file){
                    if (err) {
                        logger.error("Error in fetching YAML Documents for : " + service.name + " " + err);
                        return callback(err,null);
                    }else {
                        serviceObj.ymlFileName = file !== null ? file.fileName : file;
                        serviceObj.ymlFileData = file !== null ? file.fileData : file;
                        return callback(null, serviceObj);
                    }
                });
            }else{
                return callback(null, serviceObj);
            }
    });
}

function getMasterDetails(masterDetail,callback){
    var settingDetail = {};
    masterUtil.getOrgByRowId(masterDetail.orgId,function(err,orgs) {
        if (err) {
            logger.error("Error in fetching Org Details for : " + masterDetail.orgId + " " + err);
            return callback(err, null);
        }
        settingDetail.orgId = masterDetail.orgId;
        settingDetail.orgName = orgs.length > 0 ? orgs[0].orgname : null;
        masterUtil.getBusinessGroupName(masterDetail.bgId, function (err, businessGroupName) {
            if (err) {
                logger.error("Error in fetching Bg Name for : " + masterDetail.bgId + " " + err);
                return callback(err, null);
            }
            settingDetail.bgId = masterDetail.bgId;
            settingDetail.bgName = businessGroupName;
            masterUtil.getProjectName(masterDetail.projectId, function (err, projectName) {
                if (err) {
                    logger.error("Error in fetching Project Name for : " + masterDetail.projectId + " " + err);
                    return callback(err, null);
                }
                settingDetail.projectId = masterDetail.projectId;
                settingDetail.projectName = projectName;
                masterUtil.getEnvironmentName(masterDetail.envId, function (err, envName) {
                    if (err) {
                        logger.error("Error in fetching Env Name for : " + masterDetail.envId + " " + err);
                        return callback(err, null);
                    }
                    settingDetail.envId = masterDetail.envId;
                    settingDetail.envName = envName;
                    masterUtil.getChefDetailsById(masterDetail.configId, function (err, chefDetails) {
                        if (err) {
                            logger.error("Error in fetching Org Details for : " + masterDetail.configId + " " + err);
                            return callback(err, null);
                        }
                        settingDetail.configId = masterDetail.configId;
                        settingDetail.configName = chefDetails !== null ? chefDetails[0].configname : null;
                        callback(null,settingDetail);
                    });
                });
            });
        });
    });
}

function getServiceState(serviceStateList){
    if(serviceStateList.indexOf('error') !== -1){
        return 'Error';
    }else if(serviceStateList.indexOf('authentication_error') !== -1 || serviceStateList.indexOf('unknown') !== -1 ){
        return 'Authentication_Error';
    }else if(serviceStateList.indexOf('bootStrap_failed') !== -1){
        return 'BootStrap_Failed';
    }else if(serviceStateList.indexOf('bootStrapping') !== -1){
        return 'Initializing';
    }else if(serviceStateList.indexOf('stopped') !== -1){
        return 'Stopped';
    }else if(serviceStateList.indexOf('shutting-down') !== -1){
        return 'Shut-Down';
    }else if(serviceStateList.indexOf('pending') !== -1){
        return 'Pending';
    }else{
        return 'Running';
    }
}

function checkCredentialsForResource(resource,serviceId,resourceId,credentials,service,callback){
    var bootStrapState = 'bootStrapping',instanceCategory = resource.category;
    if(resource.resourceDetails.bootStrapState === 'success'){
        bootStrapState = 'success';
        instanceCategory = 'managed';
    }
    var nodeDetail = {
        nodeIp: resource.resourceDetails.publicIp && resource.resourceDetails.publicIp !== null ? resource.resourceDetails.publicIp : resource.resourceDetails.privateIp,
        nodeOs: resource.resourceDetails.os
    }
    commonService.checkNodeCredentials(nodeDetail, credentials, function (err, credentialFlag) {
        if (err || credentialFlag === false) {
            logger.error("Invalid Resource Credentials", err);
            callback(err,null);
            services.updateService({
                name: service.name,
                'resources': {$elemMatch: {id: resourceId}}
            }, {
                'resources.$.authentication': 'failed',
                state: 'Authentication_Error'
            }, function (err, result) {
                if (err) {
                    logger.error("Error in updating Service State:", err);
                }
            });
            resourceModel.updateResourceById(resourceId, {
                'authentication': 'failed',
            }, function (err, data) {
                if (err) {
                    logger.error("Error in updating BootStrap State:", err);
                }
            });
        } else {
            var authenticationFailedCount = 0,authenticationSuccessCount = 0,serviceState = 'Initializing',awsCheck = false;
            if(service.identifiers.aws && service.identifiers.aws !== null){
                awsCheck = true;
            }
            service.resources.forEach(function (instance) {
                if (instance.authentication === 'failed') {
                    authenticationFailedCount = authenticationFailedCount + 1;
                }
                if (instance.authentication === 'success') {
                    authenticationSuccessCount = authenticationSuccessCount + 1;
                }
            });
            if(authenticationFailedCount > 1){
                serviceState = 'Authentication_Error';
            }else if(authenticationFailedCount === 1 && awsCheck === true){
                serviceState = 'Initializing';
            }else if(authenticationFailedCount === 1 && awsCheck === false){
                serviceState = 'Running';
            }else{
                serviceState = 'Initializing';
            }
            services.updateService({
                'name': service.name,
                'resources': {$elemMatch: {id: resourceId}}
            }, {
                'resources.$.bootStrapState': bootStrapState,
                'resources.$.authentication': 'success',
                'resources.$.category': instanceCategory,
                'state': serviceState
            }, function (err, result) {
                if (err) {
                    logger.error("Error in updating Service State:", err);
                }
                resourceModel.updateResourceById(resourceId, {
                    'authentication': 'success',
                    'resourceDetails.bootStrapState': bootStrapState,
                    'category': instanceCategory,
                }, function (err, data) {
                    if (err) {
                        logger.error("Error in updating BootStrap State:", err);
                    }
                    commonService.bootstrapInstance(resource, resourceId, serviceId, serviceState, credentials, service, function (err, res) {
                        if (err) {
                            logger.error(err);
                        }else{
                            callback(null,res);
                        }
                    });
                });
            });
        }
    });
}
