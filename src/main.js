const axios = require('axios')
const normalize = require('json-api-normalize')
const config = require('./config')
const utils = require('./utils')
const auth = require('./auth')
const ui = require('./ui')

axios.defaults.baseURL = config.getBaseUrl()
axios.defaults.headers.common['Accept'] = 'application/vnd.api+json'

function getOrder() {
  return auth.getAccessToken().then(function(accessToken){
    return axios
      .get('/api/orders?include=line_items&filter[token]=' + auth.getOrderToken(), {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      })
      .then(function(response) {
        if (response.data.data.length > 0) {
          ui.hideShoppingBagUnavailableMessage()
          updateShoppingBagPreview(response.data.data[0])
          updateShoppingBagTable(response.data)
          updateShoppingBagCheckoutLink(response.data)
          return response.data.data[0]
        }
      })
  })
}

function refreshOrder() {
  var orderToken = auth.getOrderToken()
  if (orderToken) {
    getOrder().then(function(order) {
      if (order.attributes.status == 'placed') {
        createOrder()
        getOrder()
      }
    })    
  }
}

function getPrices() {

  var $prices = Array.prototype.slice.call(document.querySelectorAll('.price'), 0);

  if ($prices.length > 0) {

    var skuCodes = []

    $prices.forEach(function ($price) {
      skuCodes.push($price.dataset.skuCode)
    })

    auth.getAccessToken().then(function(accessToken){

      axios
        .get('/api/skus?filter[codes]=' + skuCodes.join(',') +'&include=prices', {
          headers: { 'Authorization': 'Bearer ' + accessToken }
        })
        .then(function(response) {
          var skus = normalize(response.data).get([
            'id',
            'code',
            'prices.formatted_amount',
            'prices.formatted_compare_at_amount',
          ])

          for (var i = 0; i < skus.length; i++) {

            var priceAmount = document.querySelector('[data-sku-code=' + skus[i].code + '] > .amount')
            if (priceAmount) {
              priceAmount.innerHTML = skus[i].prices[0].formatted_amount
            }

            var priceCompareAmount = document.querySelector('[data-sku-code=' + skus[i].code + '] > .compare-at-amount')
            if (priceCompareAmount) {
              priceCompareAmount.innerHTML = skus[i].prices[0].formatted_compare_at_amount
            }

          }
        })
    })

  }
}

function getVariants() {

  var $variants = Array.prototype.slice.call(document.querySelectorAll('.variant'), 0);

  if ($variants.length > 0) {

    var skuCodes = []

    $variants.forEach(function ($variant) {
      skuCodes.push($variant.dataset.skuCode)
    })

    auth.getAccessToken().then(function(accessToken){
      axios
        .get('/api/skus?filter[codes]=' + skuCodes.join(','), {
          headers: { 'Authorization': 'Bearer ' + accessToken }
        })
        .then(function(response) {
          var skus = normalize(response.data).get([
            'id',
            'code'
          ])

          for (var i = 0; i < skus.length; i++) {

            var variant = document.querySelector('.variant[data-sku-code=' + skus[i].code + ']')
            if (variant) {
              variant.value = skus[i].id
              variant.removeAttribute('disabled')
            }

          }
        })
    })
  }
}

function getInventory() {

  var $variantSelect = document.querySelector('.variant-select')

  if ($variantSelect) {

    $variantSelect.addEventListener('change', function () {

      var skuId = this.value
      var skuOptionText = this.options[this.selectedIndex].text;

      auth.getAccessToken().then(function(accessToken){
        axios
          .get('/api/skus/' + skuId , {
            headers: { 'Authorization': 'Bearer ' + accessToken }
          })
          .then(function(response) {
            var sku = normalize(response.data).get([
              'id',
              'inventory'
            ])

            if (sku.inventory.available) {
              ui.updateAddToBagLink(skuId, skuOptionText)
              ui.displayAvailableMessage(sku.inventory)
            }
          })
      })

    })

  }

}

function getShoppingBag() {
  var orderToken = utils.getCookie('order_token_' + countryCode)
}

function setupAddToShoppingBag() {
  var $addToBag = document.querySelector(".add-to-bag")
  if ($addToBag) {
    $addToBag.addEventListener('click', function(event){
      event.preventDefault()
      addToShoppingBag(this.dataset.skuId, this.dataset.skuName, this.dataset.skuImageUrl)
    })
  }
}

function createOrder() {

  return auth.getAccessToken().then(function(accessToken){

    return axios
      .post('/api/orders', {
        data: {
          type: 'orders',
          attributes: {
            shipping_country_code_lock: config.getCountryCode(),
            language_code: config.getLanguageCode(),
            cart_url: config.getCartUrl(),
            return_url: config.getReturnUrl(),
            privacy_url: config.getPrivacyUrl(),
            terms_url: config.getTermsUrl()
          }
        }
      },
      {
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/vnd.api+json'
        }
      }
    ).then(function(response) {
      auth.setOrderToken(response.data.data.attributes.token)
      return(response.data.data)
    })
  })

}

function createLineItem(orderId, skuId, skuName, skuImageUrl) {

  return auth.getAccessToken().then(function(accessToken){

    return axios
      .post('/api/line_items', {
        data: {
          type: 'line_items',
          attributes: {
            quantity: 1,
            name: skuName,
            image_url: skuImageUrl,
            _update_quantity: 1
          },
          relationships: {
            order: {
              data: {
                type: 'orders',
                id: orderId
              }
            },
            item: {
              data: {
                type: 'skus',
                id: skuId
              }
            }
          }
        }
      },
      {
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/vnd.api+json'
        }
      }
    )
    .then(function(response) {
      return(response.data)
    })
  })

}

function deleteLineItem(lineItemId) {

  return auth.getAccessToken().then(function(accessToken){

    return axios
      .delete('/api/line_items/' + lineItemId,
      {
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/vnd.api+json'
        }
      }
    )
    .then(function(response) {
      return true
    })
  })

}

function updateLineItem(lineItemId, attributes) {

  return auth.getAccessToken().then(function(accessToken){

    return axios
      .patch('/api/line_items/' + lineItemId, {
        data: {
          type: 'line_items',
          id: lineItemId,
          attributes: attributes
        }
      },
      {
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/vnd.api+json'
        }
      }
    )
    .then(function(response) {
      return(response.data)
    })
  })

}

function setupShoppingBagToggle() {
  var $shoppingBagToggle = document.querySelector('#shopping-bag-toggle')
  if ($shoppingBagToggle) {
    $shoppingBagToggle.addEventListener('click', function(event){
      event.preventDefault()
      ui.toggleShoppingBag()
    })
  }
}

function setupShoppingBagOpen() {
  var $shoppingBagOpen = document.querySelector('#shopping-bag-open')
  if ($shoppingBagOpen) {
    $shoppingBagOpen.addEventListener('click', function(event){
      event.preventDefault()
      ui.openShoppingBag()
    })
  }
}

function setupShoppingBagClose() {
  var $shoppingBagClose = document.querySelector('#shopping-bag-close')
  if ($shoppingBagClose) {
    $shoppingBagClose.addEventListener('click', function(event){
      event.preventDefault()
      ui.closeShoppingBag()
    })
  }
}

function updateShoppingBagPreview(order) {
  var $shoppingBagPreviewCount = document.querySelector('#shopping-bag-preview-count')
  if ($shoppingBagPreviewCount) {
    $shoppingBagPreviewCount.innerHTML = order.attributes.skus_count
  }
  var $shoppingBagPreviewTotal = document.querySelector('#shopping-bag-preview-total')
  if ($shoppingBagPreviewTotal) {
    $shoppingBagPreviewTotal.innerHTML = order.attributes.formatted_total_amount_with_taxes
  }
}

function updateShoppingBagTable(order) {
  var $shoppingBagTable = document.querySelector('#shopping-bag-table')
  if ($shoppingBagTable) {

    var normalized_order = normalize(order).get([
      'id',
      'formatted_subtotal_amount',
      'formatted_discount_amount',
      'formatted_shipping_amount',
      'formatted_payment_method_amount',
      'formatted_total_tax_amount',
      'formatted_total_amount_with_taxes',
      'line_items.id',
      'line_items.item_type',
      'line_items.image_url',
      'line_items.name',
      'line_items.quantity',
      'line_items.formatted_unit_amount',
      'line_items.formatted_total_amount'
    ])[0]

    if (normalized_order.line_items) {

      $shoppingBagTable.innerHTML = ''

      for (var i = 0; i < normalized_order.line_items.length; i++) {

        var line_item = normalized_order.line_items[i]

        if (line_item.item_type == "skus") {

          var tableRow = document.createElement('tr')

          utils.addTableColImage(tableRow, line_item.image_url, 'shopping-bag-col-image')

          utils.addTableColText(tableRow, line_item.name, 'shopping-bag-col-name')

          var quantitySelect = document.createElement('select')
          quantitySelect.dataset.lineItemId = line_item.id

          for (var qty = 1; qty <= 10; qty++) {
              var option = document.createElement("option");
              option.value = qty;
              option.text = qty;
              if (qty == line_item.quantity) {
                option.selected = true
              }
              quantitySelect.appendChild(option);
          }

          quantitySelect.addEventListener('change', function(event){
            updateLineItemQty(this.dataset.lineItemId, this.value)
          })


          utils.addTableColElement(tableRow, quantitySelect, 'shopping-bag-col-qty')


          utils.addTableColText(tableRow, line_item.formatted_total_amount, 'shopping-bag-col-total')

          // remove
          var removeLink = document.createElement('a')
          var removeLinkText = document.createTextNode('X')
          removeLink.appendChild(removeLinkText)
          removeLink.dataset.lineItemId = line_item.id

          removeLink.addEventListener('click', function(event){
            event.preventDefault()
            this.parentElement.parentElement.remove()
            removeFromShoppingBag(this.dataset.lineItemId)
          })
          utils.addTableColElement(tableRow, removeLink, 'shopping-bag-col-remove')


          $shoppingBagTable.appendChild(tableRow)

        }
      }
    }

  }
}

function updateShoppingBagCheckoutLink(order) {
  var $shoppingBagCheckoutLink = document.querySelector('#shopping-bag-checkout')
  if ($shoppingBagCheckoutLink) {
    var normalized_order = normalize(order).get([
      'line_items.id',
      'checkout_url'
    ])[0]

    if (normalized_order.line_items) {
      $shoppingBagCheckoutLink.removeAttribute('disabled')
      $shoppingBagCheckoutLink.href = normalized_order.checkout_url
    } else {
      $shoppingBagCheckoutLink.setAttribute('disabled', '')
    }
  }
}

function addToShoppingBag(skuId, skuName, skuImageUrl) {

  var orderPromise = null

  if (auth.getOrderToken()) {
    orderPromise = getOrder()
  } else {
    orderPromise = createOrder()
  }

  orderPromise.then(function(order){
    createLineItem(order.id, skuId, skuName, skuImageUrl).then(function(lineItem){
      getOrder()
      ui.openShoppingBag()
    })
    .catch(function(error) {
      switch(error.response.status) {
        case 422:
          ui.displayUnavailableMessage()
          break
      }
    })
  })

}

function removeFromShoppingBag(lineItemId) {

  deleteLineItem(lineItemId).then(function(lineItem){
    getOrder()
  })

}

function updateLineItemQty(lineItemId, quantity) {

  updateLineItem(lineItemId, { quantity: quantity }).then(function(lineItem){
    getOrder()
  })
  .catch(function(error) {
    switch(error.response.status) {
      case 422:
        ui.displayShoppingBagUnavailableMessage()
        break
    }
  })

}

exports.init = function() {
  refreshOrder()
  getPrices()
  getVariants()
  getInventory()
  setupAddToShoppingBag()
  setupShoppingBagToggle()
  setupShoppingBagOpen()
  setupShoppingBagClose()
}
