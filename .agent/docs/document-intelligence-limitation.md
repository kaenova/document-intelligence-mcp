---
layout: Conceptual
monikers:
- doc-intel-2.1.0
- doc-intel-3.0.0
- doc-intel-3.1.0
- doc-intel-4.0.0
defaultMoniker: doc-intel-4.0.0
versioningType: Ranged
title: Service quotas and limits - Document Intelligence - Foundry Tools | Microsoft Learn
canonicalUrl: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits?view=doc-intel-4.0.0
config_moniker_range: '>=doc-intel-2.1.0'
breadcrumb_path: ../../breadcrumb/azure-ai/toc.json
feedback_help_link_url: https://learn.microsoft.com/answers/tags/440/document-intelligence/
feedback_help_link_type: get-help-at-qna
feedback_product_url: https://feedback.azure.com/d365community/forum/09041fae-0b25-ec11-b6e6-000d3a4f0858?c=7a8853b4-0b25-ec11-b6e6-000d3a4f0858
feedback_system: Standard
permissioned-type: public
recommendations: true
recommendation_types:
- Training
- Certification
uhfHeaderId: azure-ai-foundry
ms.suite: office
author: laujan
learn_banner_products:
- azure
manager: nitinme
ms.author: lajanuar
ms.collection: ce-skilling-ai-copilot
ms.update-cycle: 365-days
ms.service: azure-ai-document-intelligence
description: Quick reference, detailed description, and best practices for working within Azure Document Intelligence in Foundry Tools Quotas and Limits
ms.topic: limits-and-quotas
ms.date: 2025-11-18T00:00:00.0000000Z
locale: en-us
document_id: c6c45249-134c-7c3d-68ba-9205476396fa
document_version_independent_id: 3ab8b2b7-74fa-0865-ea0a-26ea684941dd
updated_at: 2026-01-23T23:20:00.0000000Z
original_content_git_url: https://github.com/MicrosoftDocs/azure-ai-docs-pr/blob/live/articles/ai-services/document-intelligence/service-limits.md
gitcommit: https://github.com/MicrosoftDocs/azure-ai-docs-pr/blob/32afce4576ea0e043355e56c0f8b5853b6dc6981/articles/ai-services/document-intelligence/service-limits.md
git_commit_id: 32afce4576ea0e043355e56c0f8b5853b6dc6981
default_moniker: doc-intel-4.0.0
site_name: Docs
depot_name: Learn.azure-ai
page_type: conceptual
toc_rel: toc.json
word_count: 2137
asset_id: ai-services/document-intelligence/service-limits
moniker_range_name: 089c1ea5c292c012613705819fff8998
monikers:
- doc-intel-2.1.0
- doc-intel-3.0.0
- doc-intel-3.1.0
- doc-intel-4.0.0
item_type: Content
source_path: articles/ai-services/document-intelligence/service-limits.md
cmProducts:
- https://microsoft-devrel.poolparty.biz/DevRelOfferingOntology/91df3d29-834f-4393-92e2-5e393da1897c
- https://authoring-docs-microsoft.poolparty.biz/devrel/68ec7f3a-2bc6-459f-b959-19beb729907d
spProducts:
- https://microsoft-devrel.poolparty.biz/DevRelOfferingOntology/805a3516-ebe7-4153-baf7-2b9dfcf7b866
- https://authoring-docs-microsoft.poolparty.biz/devrel/90370425-aca4-4a39-9533-d52e5e002a5d
platformId: 705006b4-12e2-faca-5897-9ead67b54c53
---

# Service quotas and limits - Document Intelligence - Foundry Tools | Microsoft Learn

::: moniker range="doc-intel-3.0.0 doc-intel-3.1.0 doc-intel-4.0.0"

**This content applies to:**![checkmark](media/yes-icon.png)**v4.0 (GA)** | **Prior versions:**![blue-checkmark](media/blue-yes-icon.png)[**v3.1 (GA)**](?view=doc-intel-3.1.0&amp;preserve-view=tru)![red-checkmark](media/retire-icon.png)[**v3.0 (retiring)**](?view=doc-intel-3.0.0&amp;preserve-view=tru)

::: moniker-end

::: moniker range="doc-intel-2.1.0"

**This content applies to:**![red-checkmark](media/retire-icon.png)**v2.1** | **Latest version:**![blue-checkmark](media/blue-yes-icon.png)[**v4.0 (GA)**](?view=doc-intel-4.0.0&amp;preserve-view=tru)

::: moniker-end

This article contains both a quick reference and detailed description of Azure Document Intelligence in Foundry Tools Quotas and Limits for all [pricing tiers](https://azure.microsoft.com/pricing/details/form-recognizer/). It also contains some best practices to avoid request throttling.

## Model usage

::: moniker range="doc-intel-4.0.0"

| Document types supported | Read | Layout | Prebuilt models | Custom models | Add-on capabilities |
| --- | --- | --- | --- | --- | --- |
| PDF | ✔️ | ✔️ | ✔️ | ✔️ | ✔️ |
| Images: `JPEG/JPG`, `PNG`, `BMP`, `TIFF`, `HEIF` | ✔️ | ✔️ | ✔️ | ✔️ | ✔️ |
| Microsoft Office: `DOCX`, `PPTX`, `XLS` | ✔️ | ✔️ | ✖️ | ✖️ | ✖️ |

✔️ = supported ✖️ = Not supported

For Document Intelligence v4.0 `2024-11-30` (GA) supports page and line features with the following restrictions:

- Angle, width/height, and unit aren't supported.
- For each object detected, bounding polygon or bounding regions aren't supported.
- The `lines` object isn't supported.

::: moniker-end

::: moniker range="doc-intel-3.1.0"

| Document types supported | Read | Layout | Prebuilt models | Custom models |
| --- | --- | --- | --- | --- |
| PDF | ✔️ | ✔️ | ✔️ | ✔️ |
| Images: `JPEG/JPG`, `PNG`, `BMP`, `TIFF`, `HEIF` | ✔️ | ✔️ | ✔️ | ✔️ |
| Microsoft Office: `DOCX`, `PPTX`, `XLS` | ✔️ | ✖️ | ✖️ | ✖️ |

✔️ = supported ✖️ = Not supported

## Billing

Document Intelligence billing is calculated monthly based on the model type and the number of pages analyzed. You can find usage metrics on the metrics dashboard in the Azure portal. The dashboard displays the number of pages that Azure Document Intelligence processes. You can check the estimated cost spent on the resource by using the [Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/). For detailed instructions, see [Check usage and estimate cost](how-to-guides/estimate-cost). Here are some details:

- When you submit a document for analysis, the service analyzes all pages unless you specify a page range by using the `pages` parameter in your request. When the service analyzes Microsoft Excel and PowerPoint documents through the read, OCR, or layout model, it counts each Excel worksheet and PowerPoint slide as one page.
- When the service analyzes PDF and TIFF files, it counts each page in the PDF file or each image in the TIFF file as one page with no maximum character limits.
- When the service analyzes Microsoft Word and HTML files that the read and layout models support, it counts pages in blocks of 3,000 characters each. For example, if your document contains 7,000 characters, the two pages with 3,000 characters each and one page with 1,000 characters add up to a total of three pages.
- The read and layout models don't support analysis of embedded or linked images in Microsoft Word, Excel, PowerPoint, and HTML files. Therefore, service doesn't count them as added images.
- Training a custom model is always free with Document Intelligence. Charges are incurred only when the service uses a model to analyze a document.
- Container pricing is the same as cloud service pricing.
- Document Intelligence offers a free tier (F0) where you can test all the Document Intelligence features. The free tier limits analyze response to only the first two pages in a request.
- Document Intelligence has a commitment-based pricing model for large workloads.
- The Layout model is required to generate labels for your dataset for custom training. If the dataset that you use for custom training doesn't have label files available, the service generates them for you and bills you for layout model usage.

::: moniker-end

::: moniker range="doc-intel-3.0.0 doc-intel-3.1.0 doc-intel-4.0.0"

- [**Document Intelligence SDKs**](quickstarts/get-started-sdks-rest-api)
- [**Document Intelligence REST API**](quickstarts/get-started-sdks-rest-api)
- [**Document Intelligence Studio v3.0**](studio-overview)

::: moniker-end

::: moniker range="doc-intel-2.1.0"

- [**Document Intelligence SDKs**](quickstarts/get-started-sdks-rest-api)
- [**Document Intelligence REST API**](quickstarts/get-started-sdks-rest-api)
- [**Sample Labeling Tool v2.1**](https://fott-2-1.azurewebsites.net/)

::: moniker-end

| Quota | Free (F0)^1^ | Standard (S0) |
| --- | --- | --- |
| **Analyze transactions Per Second limit** | 1 | 15 (default value) |
| Adjustable | No | Yes ^2^ |
| **Get operations Per Second limit** | 1 | 50 (default value) |
| Adjustable | No | Yes ^2^ |
| **Model management operations Per Second limit** | 1 | 5 (default value) |
| Adjustable | No | Yes ^2^ |
| **List operations Per Second limit** | 1 | 10 (default value) |
| Adjustable | No | Yes ^2^ |
| **Max document size** | 4 MB | 500 MB |
| Adjustable | No | No |
| **Max number of pages (Analysis)** | 2 | 2000 |
| Adjustable | No | No |
| **Max size of labels file** | 10 MB | 10 MB |
| Adjustable | No | No |
| **Max size of OCR json response** | 500 MB | 500 MB |
| Adjustable | No | No |
| **Max number of Template models** | 500 | 5000 |
| Adjustable | No | No |
| **Max number of Neural models** | 100 | 500 |
| Adjustable | No | No |

::: moniker range="doc-intel-4.0.0"

## Custom model usage

- [**Custom template model**](train/custom-template)
- [**Custom neural model**](train/custom-neural)
- [**Composed classification models**](train/custom-classifier)
- [**Composed custom models**](train/composed-models)

| Quota | Free (F0)^1^ | Standard (S0) |
| --- | --- | --- |
| **Compose Model limit** | 5 | 500 (default value) |
| Adjustable | No | No |
| **Training dataset size \* Neural and Generative** | 1 GB ^3^ | 1 GB (default value) |
| Adjustable | No | No |
| **Training dataset size \* Template** | 50 MB ^4^ | 50 MB (default value) |
| Adjustable | No | No |
| **Max number of pages (Training) \* Template** | 500 | 500 (default value) |
| Adjustable | No | No |
| **Max number of pages (Training) \* Neural and Generative** | 50,000 | 50,000 (default value) |
| Adjustable | No | No |
| **Custom neural model train** | 10 hours per month ^5^ | no limit (pay by the hour), start with 10 free hours each month |
| Adjustable | No | Yes ^3^ |
| **Max number of pages (Training) \* Classifier** | 25,000 | 25,000 (default value) |
| Adjustable | No | No |
| **Max number of document types (classes) \* Classifier** | 1000 | 1000 (default value) |
| Adjustable | No | No |
| **Training dataset size \* Classifier** | 1GB | 2GB (default value) |
| Adjustable | No | No |
| **Min number of samples per class \* Classifier** | 5 | 5 (default value) |
| Adjustable | No | No |

::: moniker-end

::: moniker range="doc-intel-3.0.0"

## Custom model usage

- [**Custom template model**](train/custom-template)
- [**Custom neural model**](train/custom-neural)
- [**Composed classification models**](train/custom-classifier)
- [**Composed custom models**](train/composed-models)

| Quota | Free (F0)^1^ | Standard (S0) |
| --- | --- | --- |
| **Compose Model limit** | 5 | 200 (default value) |
| Adjustable | No | No |
| **Training dataset size \* Neural** | 1 GB ^3^ | 1 GB (default value) |
| Adjustable | No | No |
| **Training dataset size \* Template** | 50 MB ^4^ | 50 MB (default value) |
| Adjustable | No | No |
| **Max number of pages (Training) \* Template** | 500 | 500 (default value) |
| Adjustable | No | No |
| **Max number of pages (Training) \* Neural** | 50,000 | 50,000 (default value) |
| Adjustable | No | No |
| **Custom neural model train** | 10 per month | 20 per month |
| Adjustable | No | Yes ^3^ |
| **Max number of pages (Training) \* Classifier** | 10,000 | 10,000 (default value) |
| Adjustable | No | No |
| **Max number of document types (classes) \* Classifier** | 500 | 500 (default value) |
| Adjustable | No | No |
| **Training dataset size \* Classifier** | 1GB | 1GB (default value) |
| Adjustable | No | No |
| **Min number of samples per class \* Classifier** | 5 | 5 (default value) |
| Adjustable | No | No |

::: moniker-end

::: moniker range="doc-intel-3.1.0"

## Custom model usage

- [**Custom template model**](train/custom-template)
- [**Custom neural model**](train/custom-neural)
- [**Composed classification models**](train/custom-classifier)
- [**Composed custom models**](train/composed-models)

| Quota | Free (F0)^1^ | Standard (S0) |
| --- | --- | --- |
| **Compose Model limit** | 5 | 200 (default value) |
| Adjustable | No | No |
| **Training dataset size \* Neural** | 1 GB ^3^ | 1 GB (default value) |
| Adjustable | No | No |
| **Training dataset size \* Template** | 50 MB ^4^ | 50 MB (default value) |
| Adjustable | No | No |
| **Max number of pages (Training) \* Template** | 500 | 500 (default value) |
| Adjustable | No | No |
| **Max number of pages (Training) \* Neural** | 50,000 | 50,000 (default value) |
| Adjustable | No | No |
| **Custom neural model train** | 10 per month | 20 per month |
| Adjustable | No | Yes ^3^ |
| **Max number of pages (Training) \* Classifier** | 10,000 | 10,000 (default value) |
| Adjustable | No | No |
| **Max number of document types (classes) \* Classifier** | 500 | 500 (default value) |
| Adjustable | No | No |
| **Training dataset size \* Classifier** | 1GB | 1GB (default value) |
| Adjustable | No | No |
| **Min number of samples per class \* Classifier** | 5 | 5 (default value) |
| Adjustable | No | No |

::: moniker-end

::: moniker range="doc-intel-2.1.0"

## Custom model limits

- [**Custom template model**](train/custom-template)
- [**Composed custom models**](train/composed-models)

| Quota | Free (F0)^1^ | Standard (S0) |
| --- | --- | --- |
| **Compose Model limit** | 5 | 200 (default value) |
| Adjustable | No | No |
| **Training dataset size** | 50 MB | 50 MB (default value) |
| Adjustable | No | No |
| **Max number of pages (Training)** | 500 | 500 (default value) |
| Adjustable | No | No |

::: moniker-end

::: moniker range="doc-intel-2.1.0 doc-intel-3.0.0 doc-intel-3.1.0 doc-intel-4.0.0"

> 
> ^1^ For **Free (F0)** pricing tier see also monthly allowances at the [pricing page](https://azure.microsoft.com/pricing/details/ai-document-intelligence/).^2^ See best practices, and adjustment instructions.^3^ Neural models training count is reset every calendar month. Open a support request to increase the monthly training limit. Starting with the v4.0 API, training requests over 20 requests in a calendar month are billed on the training tier. See [pricing](https://azure.microsoft.com/pricing/details/ai-document-intelligence/) for details.

::: moniker-end

::: moniker range="doc-intel-3.0.0 doc-intel-3.1.0 doc-intel-4.0.0"

> 
> ^4^ This limit applies to all documents found in your training dataset folder prior to any labeling-related updates.

::: moniker-end

::: moniker range="doc-intel-4.0.0"

> 
> ^5^ This limit applies for `v 4.0 (2024-11-30 GA)` custom neural models only. Starting from `v 4.0`, we support training larger documents for longer durations (up to 10 hours for free, and incurring charges after). For more information, please refer to [custom neural model page](train/custom-neural).

::: moniker-end

## Detailed description, Quota adjustment, and best practices

The default limits can be extended by requesting an increase via a support ticket. Before requesting a quota increase (where applicable), ensure that it's necessary.

If your application returns Response Code 429 (*Too many requests*) you are over the threshold for one or more of the transactions per second limits (TPS):

- **Analyze transactions Per Second limit** The TPS for submitting analyze requests (POST)
- **Get operations Per Second limit** The TPS for polling for results on analyze operations (GET)
- **Model management operations Per Second limit** Operations related to model management like build/train and copy.
- **List operations Per Second limit** Operations related to listing models, operations.

### General best practices to mitigate throttling

To minimize issues related to throttling (Response Code 429), we recommend using the following techniques:

- Implement retry logic in your application
- Avoid sharp changes in the workload. Increase the workload gradually *Example.* Your application is using Document Intelligence and your current workload is 10 TPS (transactions per second). The next second you increase the load to 40 TPS. The result is a 429 response code for some requests as you are over the 15 TPS limit for submitting analyze operations. You could either back off the processing to stay under the 15 TPS or request an increase on the TPS to support your higher volumes.

The next sections describe specific cases of adjusting quotas. Jump to Document Intelligence: increasing concurrent request limit

### Increasing transactions per second request limit

By default the number of transactions per second is limited to 15 transactions per second for a Document Intelligence resource. For the Standard pricing tier, TPS increase requests can be submitted, but whether they can be approved and at what TPS level adjustment will depend on the daily usage patterns and the best practices that are being followed. Before submitting the request, ensure you're familiar with the material in this section and aware of these best practices.

Increasing the Concurrent Request limit does **not** directly affect your costs. Document Intelligence service uses "Pay only for what you use" model. The limit defines how high the Service can scale before it starts throttle your requests.

The existing value of different request limit categories is available via Azure portal, under the monitoring tab on the resource overview blade.

#### Create and submit support request for TPS increase

Initiate the increase of transactions per second(TPS) limit for your resource by submitting the Support Request:

- Sign in to the [Azure portal](https://portal.azure.com)
- Select the Document Intelligence Resource for which you would like to increase the TPS limit
- Select -New support request- (-Support + troubleshooting- group). A new window appears with autopopulated information about your Azure Subscription and Azure Resource
- Enter -Summary- (like "Increase Document Intelligence TPS limit")
- Select "Quota or usage validation" for problem type field.
- Select -Next: Solutions-
- Proceed further with the request creation
- Enter the following information in the -Description- field, under the Details tab:
    - a note, that the request is about Document Intelligence quota.
    - Provide a TPS expectation you would like to scale to meet. While TPS increases are free, you should only request a TPS that is reasonable for your workload.
    - Azure resource information
    - Complete entering the required information and select -Create- button in -Review + create- tab
    - Note the support request number in Azure portal notifications. Look for Support to contact you shortly for further processing.

## Example of a workload pattern best practice

This example presents the approach we recommend following to mitigate possible request throttling. It isn't an *exact recipe*, but merely a template we invite to follow and adjust as necessary.

Let us suppose that a Document Intelligence resource has the default limit set. Start the workload to submit your analyze requests. If you find that you're seeing frequent throttling with response code 429 when checking for completion, start by implementing an exponential backoff on the GET analyze response request. By using a progressively longer wait time between retries for consecutive error responses, for example a 2-5-13-34 pattern of delays between requests. In general, we recommend not calling the get analyze response more than once every 2 seconds for a corresponding POST request. The `analyze` response also contains a **retry-after** header that indicates how long you should wait in seconds before checking for completion of that request.

If you find that you're being throttled on the number of POST requests for documents being submitted, consider adding a delay between the requests. If your workload requires a higher degree of concurrent processing, you then need to create a support request to increase your service limits on transactions per second.

Generally, we recommend testing the workload and the workload patterns before going to production.