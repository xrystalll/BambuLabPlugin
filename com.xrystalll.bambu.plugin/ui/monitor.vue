
<template>
  <v-container>
    <v-card prepend-icon="mdi-pencil" :title="$t('Designer.UI.Title')"></v-card>
    <v-card-text>
      <v-row>
        <v-col cols="6">
          <v-text-field v-model="modelValue.data.printerIp" :label="$t('Designer.UI.IP')" type="text" hide-details
            outlined class="mx-2"></v-text-field>
        </v-col>
        <v-col cols="6">
          <v-text-field v-model="modelValue.data.accessCode" :label="$t('Designer.UI.AccessCode')" type="text" hide-details
            outlined class="mx-2"></v-text-field>
        </v-col>
        <v-col cols="6">
          <v-text-field v-model="modelValue.data.serialNumber" :label="$t('Designer.UI.SN')" type="text" hide-details
            outlined class="mx-2"></v-text-field>
        </v-col>
      </v-row>
    </v-card-text>
    <v-card-actions>
      <v-spacer></v-spacer>
      <v-btn variant="text" icon @click="saveConfig">
        <v-icon>mdi-check-circle-outline</v-icon>
      </v-btn>
    </v-card-actions>
  </v-container>
</template>

<script>
export default {
    props: {
        modelValue: {
            type: Object,
            required: true,
        },
    },
    data() {
        return {
        };
    },
    methods: {
        saveConfig() {
            this.$fd.setConfig(this.modelValue.data)
            this.$fd.showSnackbarMessage("success", this.$t('Designer.UI.SaveSuccess'));
        }
    },
    mounted() {
    }
};
</script>

<style scoped></style>
