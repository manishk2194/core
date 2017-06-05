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
var appConfig = require('_pr/config');
var fileIo = require('_pr/lib/utils/fileio');
var masterUtil = require('_pr/lib/utils/masterUtil.js');
const ymlJs= require('yamljs');

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
            services.getAllServicesByFilter(queryObj, next);
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

serviceMapService.deleteService = function deleteService(serviceId,callback){
    async.waterfall([
        function(next){
            services.getServiceById(serviceId,next);
        },
        function(servicesData,next){
            if(servicesData.length > 0){
                services.deleteServiceById(serviceId,next);
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

serviceMapService.createNewService = function createNewService(servicesObj,callback){
    if(servicesObj.type !== 'Service') {
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
        fileUpload.getReadStreamFileByFileId(servicesObj.fileId, function (err, fileDetail) {
            if (err) {
                logger.error("Error in reading YAML File.");
                callback(err, null);
                return;
            } else {
                var fileName = uuid.v4() + '_' + fileDetail.fileName;
                var desPath = appConfig.tempDir + fileName;
                fileIo.writeFile(desPath, fileDetail.fileData, false, function (err) {
                    if (err) {
                        logger.error("Unable to write file");
                        callback(err, null);
                        return;
                    } else {
                        ymlJs.load(desPath, function (result) {
                            if(result !== null){
                                servicesObj.identifiers = results;
                                servicesObj.ymlFileId = servicesObj.fileId;
                                servicesObj.createdOn = new Date().getTime();
                                services.createNew(servicesObj, function (err, servicesData) {
                                    if (err) {
                                        logger.error("services.createNew is Failed ==>", err);
                                        callback(err, null);
                                        apiUtil.removeFile(desPath);
                                        return;
                                    } else {
                                        callback(null, servicesData);
                                        apiUtil.removeFile(desPath);
                                        return;
                                    }
                                });
                            }else{
                                var err = new Error("There is no data present YML.")
                                err.code = 403;
                                callback(err, null);
                                apiUtil.removeFile(desPath);
                            }
                        })
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
                var err =  new Error();
                err.code = 500;
                err.message = "No Service is available in DB against name "+resourceName;
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

serviceMapService.getLastVersionOfEachService = function getLastVersionOfEachService(callback){
    async.waterfall([
        function(next){
            services.getLastVersionOfEachService(next);
        },
        function(servicesData,next){
            if(servicesData.length > 0){
                next(null,servicesData);
            }else{
                logger.debug("No Service is available in DB against filterBy: "+JSON.stringify(filterBy));
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
                services.updatedService(filterQuery,data,next);
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
            if(servicesData !== null){

            }else{
                var err =  new Error();
                err.code = 500;
                err.message = "No Service is available in DB against serviceId "+serviceId;
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



serviceMapService.getServiceById = function getServiceById(serviceId,callback){
    async.waterfall([
        function(next){
            services.getServiceById(serviceId,next);
        },
        function(services,next){
            changeServiceResponse(services,next);
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

function changeServiceResponse(services,callback){
    var serviceList  = [],resultList =[];
    if(services.docs && services.docs.length > 0){
        serviceList = services.docs;
    }else{
        serviceList = services;
    }
    if(serviceList.length > 0){
        for(var  i = 0 ; i < serviceList.length; i++){
            (function(service){
                var serviceObj = {
                    masterDetails:service.masterDetails,
                    providerDetails:service.providerDetails,
                    name:service.name,
                    type:service.type,
                    desc:service.desc,
                    state:service.state,
                    identifiers:service.identifiers,
                    resources:service.resources,
                    createdOn:service.createdOn
                }
                masterUtil.getOrgByRowId(service.masterDetails.orgId,function(err,orgs){
                    if (err) {
                        logger.error("Error in fetching Org Details for : " + service.masterDetails.orgId + " " + err);
                    }
                    serviceObj.masterDetails.orgName =  orgs !== null ? orgs[0].name : null;
                    masterUtil.getBusinessGroupName(service.masterDetails.bgId,function(err,businessGroupName) {
                        if (err) {
                            logger.error("Error in fetching Bg Name for : " + service.masterDetails.bgId + " " + err);
                        }
                        serviceObj.masterDetails.bgName = businessGroupName;
                        masterUtil.getProjectName(service.masterDetails.projectId,function(err,projectName){
                            if (err) {
                                logger.error("Error in fetching Project Name for : " + service.masterDetails.projectId + " " + err);
                            }
                            serviceObj.masterDetails.projectName =  projectName;
                            masterUtil.getEnvironmentName(service.masterDetails.envId,function(err,envName){
                                if (err) {
                                    logger.error("Error in fetching Env Name for : " + service.masterDetails.envId + " " + err);
                                }
                                serviceObj.masterDetails.envName =  envName;
                                masterUtil.getChefDetailsById(service.masterDetails.chefServerId,function(err,chefDetails){
                                    if (err) {
                                        logger.error("Error in fetching Org Details for : " + service.masterDetails.chefServerId + " " + err);
                                    }
                                    serviceObj.masterDetails.chefServerName =  chefDetails !== null ? chefDetails[0].configname : null;
                                    if(service.ymlFileId){
                                        fileUpload.getReadStreamFileByFileId(service.ymlFileId,function(err,file){
                                            if (err) {
                                                logger.error("Error in fetching YAML Documents for : " + service.name + " " + err);
                                            }else{
                                                serviceObj.ymlFileName =  file !== null ? file.fileName : file;
                                                serviceObj.ymlFileData = file !== null ? file.fileData : file;
                                                if(serviceObj.masterDetails.monitorId && serviceObj.masterDetails.monitorId  !== null){
                                                    monitors.getById(serviceObj.masterDetails.monitorId,function(err,monitorDetails){
                                                        if (err) {
                                                            logger.error("Error in fetching Monitor Details for : " + service.masterDetails.monitorId + " " + err);
                                                        }
                                                        serviceObj.masterDetails.monitorName = monitorDetails !== null ? monitorDetails.name : null;
                                                        resultList.push(serviceObj);
                                                        if(resultList.length === serviceList.length){
                                                            if(services.docs){
                                                                services.docs = resultList;
                                                            }else{
                                                                services = resultList;
                                                            }
                                                            return callback(null,services);
                                                        }
                                                    })
                                                }else{
                                                    resultList.push(serviceObj);
                                                    if(resultList.length === serviceList.length){
                                                        if(services.docs){
                                                            services.docs = resultList;
                                                        }else{
                                                            services = resultList;
                                                        }
                                                        return callback(null,services);
                                                    }
                                                }
                                            }
                                        });
                                    }else if(serviceObj.masterDetails.monitorId && serviceObj.masterDetails.monitorId  !== null) {
                                        monitors.getById(serviceObj.masterDetails.monitorId, function (err, monitorDetails) {
                                            if (err) {
                                                logger.error("Error in fetching Monitor Details for : " + service.masterDetails.monitorId + " " + err);
                                            }
                                            serviceObj.masterDetails.monitorName = monitorDetails !== null ? monitorDetails.name : null;
                                            resultList.push(serviceObj);
                                            if(resultList.length === serviceList.length){
                                                if(services.docs){
                                                    services.docs = resultList;
                                                }else{
                                                    services = resultList;
                                                }
                                                return callback(null,services);
                                            }
                                        })
                                    }else{
                                        resultList.push(serviceObj);
                                        if(resultList.length === serviceList.length){
                                            if(services.docs){
                                                services.docs = resultList;
                                            }else{
                                                services = resultList;
                                            }
                                            return callback(null,services);
                                        }
                                    }
                                });
                            });
                        });
                    });
                });

            })(serviceList[i]);
        }
    }else{
        return callback(null,serviceList);
    }
}

function keyMappingForYmlIdentifiers(identifierList,callback){
    var queryObj = {},awsIdentifiers = [],chefIdentifiers = [],resultObj = {};
    if(identifierList.length > 0){
        identifierList.forEach(function(identifier){
            Object.keys(identifier).forEach(function (key) {
                if (key === 'aws') {
                    Object.keys(identifier[key]).forEach(function (awsIdentifierKey) {
                        if (awsIdentifierKey === 'ami') {
                            queryObj = {
                                type: awsIdentifierKey,
                                query: {
                                    'resourceDetails.amiId': {$in: identifier[key][awsIdentifierKey]}
                                },
                                value: identifier[key][awsIdentifierKey]
                            }
                            awsIdentifiers.push(queryObj);
                        } else if (awsIdentifierKey === 'ip') {
                            queryObj = {
                                type: awsIdentifierKey,
                                query: {
                                    $or: [
                                        {'resourceDetails.privateIp': {$in: identifier[key][awsIdentifierKey]}},
                                        {'resourceDetails.publicIp': {$in: identifier[key][awsIdentifierKey]}}
                                    ]
                                },
                                value: identifier[key][awsIdentifierKey]
                            }
                            awsIdentifiers.push(queryObj);
                        } else if (awsIdentifierKey === 'subnet') {
                            queryObj = {
                                type: awsIdentifierKey,
                                query: {
                                    'resourceDetails.subnetId': {$in: identifier[key][awsIdentifierKey]}
                                },
                                value: identifier[key][awsIdentifierKey]
                            }
                            awsIdentifiers.push(queryObj);
                        } else if (awsIdentifierKey === 'keyPairName') {
                            queryObj = {
                                type: awsIdentifierKey,
                                query: {
                                    'providerDetails.keyPairName': {$in: identifier[key][awsIdentifierKey]}
                                },
                                value: identifier[key][awsIdentifierKey]
                            }
                            awsIdentifiers.push(queryObj);
                        } else if (awsIdentifierKey === 'groups') {
                            var query = {};
                            Object.keys(identifier[key][awsIdentifierKey]).forEach(function (groupObjKey) {
                                if (groupObjKey === 'ami') {
                                    query = {
                                        'resourceDetails.amiId': {$in: identifier[key][awsIdentifierKey][groupObjKey]}
                                    }
                                } else if (groupObjKey === 'ip') {
                                    query = {
                                        $or: [
                                            {'resourceDetails.privateIp': {$in: identifier[key][awsIdentifierKey][groupObjKey]}},
                                            {'resourceDetails.publicIp': {$in: identifier[key][awsIdentifierKey][groupObjKey]}}
                                        ]
                                    }
                                } else if (key === 'keyPairName') {
                                    query = {
                                        'providerDetails.keyPairName': {$in: identifier[key][awsIdentifierKey][groupObjKey]}
                                    }
                                } else if (groupObjKey === 'subnet') {
                                    query = {
                                        'resourceDetails.subnetId': {$in: identifier[key][awsIdentifierKey][groupObjKey]}
                                    }
                                } else if (groupObjKey === 'tags') {
                                    query = {
                                        'resourceDetails.tags': {$in: identifier[key][awsIdentifierKey][groupObjKey]}
                                    }
                                } else {
                                    logger.debug("In-valid identifiers in groups:");
                                }
                            });
                            queryObj = {
                                type: awsIdentifierKey,
                                query: query,
                                value: identifier[key][awsIdentifierKey]
                            }
                            awsIdentifiers.push(queryObj);
                        } else if (awsIdentifierKey === 'tags') {
                            var query = {};
                            Object.keys(identifier[key][awsIdentifierKey]).forEach(function (tagKey) {
                                query['resourceDetails.tags'][tagKey] = identifier[key][awsIdentifierKey][tagKey];
                            });
                            queryObj = {
                                type: awsIdentifierKey,
                                query: query,
                                value: identifier[key][awsIdentifierKey]
                            }
                            awsIdentifiers.push(queryObj);
                        } else {
                            logger.debug("In-valid identifiers:");
                        }
                    });
                    resultObj = {
                        aws:awsIdentifiers
                    }
                }else if(key ==='chef'){
                    Object.keys(identifier[key]).forEach(function (chefIdentifierKey) {
                        if (chefIdentifierKey === 'roles') {
                            queryObj = {
                                type: chefIdentifierKey,
                                query: {
                                    'chefServerDetails.run_list': {$in: identifier[key][chefIdentifierKey]}
                                },
                                value: identifier[key][chefIdentifierKey]
                            }
                            chefIdentifiers.push(queryObj);
                        } else if (chefIdentifierKey === 'groups') {
                            var query = {};
                            Object.keys(identifier[key][chefIdentifierKey]).forEach(function (groupObjKey) {
                                if (groupObjKey === 'roles') {
                                    query = {
                                        'chefServerDetails.run_list': {$in: identifier[key][chefIdentifierKey][groupObjKey]}
                                    }
                                } else {
                                    logger.debug("In-valid identifiers in groups:");
                                }
                            });
                            queryObj = {
                                type: chefIdentifierKey,
                                query: query,
                                value: identifier[key][chefIdentifierKey]
                            }
                            chefIdentifiers.push(queryObj);
                        } else {
                            logger.debug("In-valid identifiers:");
                        }
                    })
                    resultObj = {
                        chef:chefIdentifiers
                    }
                }
            })

        });
        return callback(null,resultObj);
    }else{
        return callback(null,resultObj);
    }
}



